#!/usr/bin/env python3
"""Create an encrypted Supabase Postgres dump and upload it to Google Drive."""
import os
import subprocess
import tempfile
from datetime import datetime, timezone

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

SCOPES = ["https://www.googleapis.com/auth/drive.file"]
FOLDER_NAME = "Shobdk-Database-Backups"
KEEP_BACKUPS = 30


def required_env(name):
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def main():
    database_url = required_env("SUPABASE_DB_URL")
    passphrase = required_env("BACKUP_ENCRYPTION_PASSPHRASE")
    client_id = required_env("GOOGLE_CLIENT_ID")
    client_secret = required_env("GOOGLE_CLIENT_SECRET")
    refresh_token = required_env("GOOGLE_REFRESH_TOKEN")

    credentials = Credentials(
        token=None,
        refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=client_id,
        client_secret=client_secret,
        scopes=SCOPES,
    )
    drive = build("drive", "v3", credentials=credentials, cache_discovery=False)

    # With drive.file, this automation manages only files/folders it creates.
    folders = drive.files().list(
        q="name = '{}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false".format(FOLDER_NAME),
        spaces="drive",
        pageSize=100,
        fields="files(id,name,createdTime)",
        orderBy="createdTime desc",
    ).execute().get("files", [])

    if folders:
        folder_id = folders[0]["id"]
    else:
        folder = drive.files().create(
            body={"name": FOLDER_NAME, "mimeType": "application/vnd.google-apps.folder"},
            fields="id",
        ).execute()
        folder_id = folder["id"]

    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d_%H-%M-%S_UTC")
    filename = f"shobdk-database-{stamp}.dump.enc"

    with tempfile.TemporaryDirectory() as temp_dir:
        dump_path = os.path.join(temp_dir, "database.dump")
        encrypted_path = os.path.join(temp_dir, filename)

        subprocess.run(
            ["/usr/lib/postgresql/17/bin/pg_dump", "--format=custom", "--no-owner", "--no-acl", "--file", dump_path, database_url],
            check=True,
        )
        subprocess.run(
            [
                "openssl", "enc", "-aes-256-cbc", "-salt", "-pbkdf2", "-iter", "200000",
                "-in", dump_path, "-out", encrypted_path,
                "-pass", "env:BACKUP_ENCRYPTION_PASSPHRASE",
            ],
            check=True,
            env={**os.environ, "BACKUP_ENCRYPTION_PASSPHRASE": passphrase},
        )

        uploaded = drive.files().create(
            body={"name": filename, "parents": [folder_id], "description": "Encrypted Supabase PostgreSQL database backup"},
            media_body=MediaFileUpload(encrypted_path, mimetype="application/octet-stream", resumable=True),
            fields="id,name,size,createdTime",
        ).execute()

    # Retain the newest 30 backups created by this automation.
    files = drive.files().list(
        q=f"'{folder_id}' in parents and trashed = false and name contains '.dump.enc'",
        spaces="drive",
        pageSize=1000,
        fields="files(id,name,createdTime)",
        orderBy="createdTime desc",
    ).execute().get("files", [])
    for old_file in files[KEEP_BACKUPS:]:
        drive.files().delete(fileId=old_file["id"]).execute()

    print(f"Backup uploaded successfully: {uploaded.get('name')}")
    print(f"Encrypted file size: {uploaded.get('size', 'unknown')} bytes")
    print(f"Retention: newest {KEEP_BACKUPS} backups are kept.")


if __name__ == "__main__":
    main()
