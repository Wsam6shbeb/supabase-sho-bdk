// ===============================================================
// شرح الملف: هذا صفحة إنشاء حساب.
// الهدف: توضيح وظيفة الملف ومهام الدوال دون تغيير منطق البرنامج.
// الدوال/الوظائف المعرّفة هنا: RegisterScreen، handlePickFromGallery، handleTakePhoto، handleRemoveAvatar، handleRegister.
// ملاحظة: التعليقات التالية للشرح فقط؛ لا تغيّر سلوك الكود.
// ===============================================================

// ═══════════════════════════════════════════════════════════
// شاشة إنشاء حساب جديد
// ═══════════════════════════════════════════════════════════

import { ScreenSafeArea } from '@/components/ui/ScreenSafeArea';
import { KEYBOARD_AVOIDING_BEHAVIOR } from '@/constants/keyboard';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppTextInput } from '@/components/ui/AppTextInput';
import {
    BorderWidth,
    Colors,
    FontSizes,
    FontWeights,
    Radii,
    Spacing,
} from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/ar';
import { api } from '@/services/api';
import type { RegisterDto } from '@/types/auth';
import type { Region } from '@/types/common';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { Link, router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
    FlatList,
    Image,
    KeyboardAvoidingView,
    Modal,
    Pressable,
    ScrollView, StyleSheet, Text,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface FormErrors {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  region?: string | null;
  password?: string | null;
  confirmPassword?: string | null;
  form?: string | null;
}

// [شرح الدالة: RegisterScreen] يعرض نموذج إنشاء الحساب ويجمع بيانات المستخدم المطلوبة.
export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const scheme = Colors[theme];
  const { register, isLoading, lastError, clearError } = useAuth();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [region, setRegion] = useState<Region | null>(null);
  const [regionPickerOpen, setRegionPickerOpen] = useState(false);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [avatarBase64, setAvatarBase64] = useState<string | null>(null);
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const lastErrorMsg = lastError?.message ?? null;
  const formLevelError = errors.form ?? lastErrorMsg;

  const regions = useMemo(() => api.auth.SYRIAN_REGIONS, []);

// [شرح الدالة: handlePickFromGallery] يفتح معرض الصور لاختيار صورة الملف الشخصي.
  const handlePickFromGallery = async () => {
    setAvatarPickerOpen(false);
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        setErrors((p) => ({ ...p, form: t('auth.register.avatarPermissionDenied') }));
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      });
      if (!result.canceled && result.assets?.length) {
        const asset = result.assets[0];
        setAvatar(asset.uri);
        setAvatarBase64(asset.base64 ?? null);
        setErrors((p) => ({ ...p, form: null }));
      }
    } catch {
      setErrors((p) => ({ ...p, form: t('common.somethingWentWrong') }));
    }
  };

// [شرح الدالة: handleTakePhoto] يفتح الكاميرا لالتقاط صورة الملف الشخصي.
  const handleTakePhoto = async () => {
    setAvatarPickerOpen(false);
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        setErrors((p) => ({ ...p, form: t('auth.register.avatarPermissionDenied') }));
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      });
      if (!result.canceled && result.assets?.length) {
        const asset = result.assets[0];
        setAvatar(asset.uri);
        setAvatarBase64(asset.base64 ?? null);
        setErrors((p) => ({ ...p, form: null }));
      }
    } catch {
      setErrors((p) => ({ ...p, form: t('common.somethingWentWrong') }));
    }
  };

// [شرح الدالة: handleRemoveAvatar] يزيل صورة الملف الشخصي المختارة.
  const handleRemoveAvatar = () => {
    setAvatarPickerOpen(false);
    setAvatar(null);
    setAvatarBase64(null);
  };

  const validate = (): boolean => {
    const next: FormErrors = {};
    if (!name.trim()) next.name = t('auth.register.requiredName');
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      next.email = t('auth.login.requiredEmail');
    } else if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      next.email = t('auth.login.invalidEmail');
    }
    if (!phone.trim()) next.phone = t('auth.register.requiredPhone');
    if (!region) next.region = t('auth.register.requiredRegion');
    if (!password) next.password = t('auth.login.requiredPassword');
    else if (password.length < 6) next.password = t('auth.login.shortPassword');
    if (!confirmPassword) next.confirmPassword = t('auth.login.requiredPassword');
    else if (password !== confirmPassword) next.confirmPassword = t('auth.register.passwordMismatch');
    setErrors(next);
    return Object.keys(next).length === 0;
  };

// [شرح الدالة: handleRegister] يعالج إرسال بيانات التسجيل وإنشاء الحساب.
  const handleRegister = async () => {
    if (submitting) return;
    clearError();
    setErrors({});
    if (!validate()) return;
    setSubmitting(true);
    try {
      const dto: RegisterDto = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        phone: phone.trim(),
        region_id: region ? region.id : regions[0].id,
        avatar_base64: avatarBase64,
      };
      const result = await register(dto);
      if (result) {
        router.push({ pathname: '/auth/verify-email', params: { email: result.email } });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenSafeArea style={[styles.safe, { backgroundColor: scheme.background }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={KEYBOARD_AVOIDING_BEHAVIOR}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.headerRow}>
            <Link href="/auth/login" asChild>
              <Pressable style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
                <Text style={StyleSheet.flatten([styles.backText, { color: scheme.primary }])}>← رجوع</Text>
              </Pressable>
            </Link>
          </View>

          <View style={styles.header}>
            <Text style={[styles.title, { color: scheme.text }]}>
              {t('auth.register.title')}
            </Text>
            <Text style={[styles.subtitle, { color: scheme.textSecondary }]}>
              {t('auth.register.subtitle')}
            </Text>
          </View>

          <View style={styles.form}>
            <AppTextInput
              label={t('auth.register.nameLabel')}
              placeholder={t('auth.register.namePlaceholder')}
              value={name}
              onChangeText={(val) => { setName(val); setErrors((p) => ({ ...p, name: null, form: null })); }}
              error={errors.name}
              required
            />

            <AppTextInput
              label={t('auth.register.phoneLabel')}
              placeholder={t('auth.register.phonePlaceholder')}
              type="phone"
              value={phone}
              onChangeText={(val) => { setPhone(val); setErrors((p) => ({ ...p, phone: null })); }}
              error={errors.phone}
              required
            />

            <View style={styles.pickerField}>
              <Text style={[styles.pickerLabel, { color: scheme.text }]}>
                {t('auth.register.regionLabel')}
                <Text style={{ color: scheme.danger }}> *</Text>
              </Text>
              <Pressable
                onPress={() => setRegionPickerOpen(true)}
                style={({ pressed }) => [
                  styles.pickerBox,
                  {
                    backgroundColor: scheme.inputBackground,
                    borderColor: errors.region ? scheme.danger : scheme.border,
                    borderWidth: errors.region ? BorderWidth.thick : BorderWidth.thin,
                    borderRadius: Radii.lg,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Text
                  style={{
                    color: region ? scheme.text : scheme.textTertiary,
                    fontSize: FontSizes.base,
                    textAlign: 'right',
                  }}
                >
                  {region ? region.name_ar : t('auth.register.regionPlaceholder')}
                </Text>
                <Text style={{ color: scheme.textTertiary, fontSize: FontSizes.lg }}>▾</Text>
              </Pressable>
              {errors.region ? (
                <Text style={[styles.pickerError, { color: scheme.danger }]}>{errors.region}</Text>
              ) : null}
            </View>

            <View style={styles.avatarField}>
              <Text style={[styles.pickerLabel, { color: scheme.text }]}>
                {t('auth.register.avatarLabel')}
              </Text>
              <Pressable
                onPress={() => setAvatarPickerOpen(true)}
                style={({ pressed }) => [
                  styles.avatarBox,
                  {
                    backgroundColor: scheme.backgroundElement,
                    borderColor: scheme.border,
                    borderWidth: BorderWidth.thin,
                    borderRadius: Radii.lg,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                {avatar ? (
                  <Image source={{ uri: avatar }} style={styles.avatarImage} />
                ) : (
                  <View style={styles.avatarPlaceholderContent}>
                    <Ionicons
                      name="camera"
                      size={28}
                      color={scheme.textTertiary}
                      style={{ marginBottom: Spacing.two }}
                    />
                    <Text style={{ color: scheme.textTertiary, fontSize: FontSizes.sm, textAlign: 'center' }}>
                      {t('auth.register.avatarUpload')}
                    </Text>
                  </View>
                )}
              </Pressable>
            </View>

            <View style={{ height: Spacing.two }} />

            <AppTextInput
              label={t('auth.register.emailLabel')}
              placeholder={t('auth.register.emailPlaceholder')}
              type="email"
              value={email}
              onChangeText={(val) => { setEmail(val); setErrors((p) => ({ ...p, email: null, form: null })); }}
              error={errors.email}
              required
            />

            <AppTextInput
              label={t('auth.register.passwordLabel')}
              placeholder={t('auth.register.passwordPlaceholder')}
              type="password"
              value={password}
              onChangeText={(val) => { setPassword(val); setErrors((p) => ({ ...p, password: null, confirmPassword: null })); }}
              error={errors.password}
              required
            />

            <AppTextInput
              label={t('auth.register.confirmPasswordLabel')}
              placeholder={t('auth.register.confirmPasswordPlaceholder')}
              type="password"
              value={confirmPassword}
              onChangeText={(val) => { setConfirmPassword(val); setErrors((p) => ({ ...p, confirmPassword: null })); }}
              error={errors.confirmPassword}
              required
            />

            {formLevelError ? (
              <View style={[styles.errorBox, { backgroundColor: `${scheme.danger}15` }]}>
                <Text style={[styles.errorBoxText, { color: scheme.danger }]}>
                  {formLevelError === 'البريد الإلكتروني مستخدم بالفعل'
                    ? formLevelError
                    : t('auth.register.emailUsed')}
                </Text>
              </View>
            ) : null}

            <View style={{ marginTop: Spacing.four }}>
              <AppButton
                title={t('auth.register.registerBtn')}
                variant="primary"
                size="lg"
                onPress={handleRegister}
                loading={isLoading || submitting}
                disabled={isLoading || submitting}
              />
            </View>
          </View>

          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: scheme.textSecondary }]}>
              {t('auth.register.hasAccount')}{' '}
            </Text>
            <Link href="/auth/login" asChild>
              <Text style={StyleSheet.flatten([styles.footerAction, { color: scheme.primary }])}>
                {t('auth.register.loginHere')}
              </Text>
            </Link>
          </View>
        </ScrollView>

        <Modal
          visible={regionPickerOpen}
          animationType="slide"
          transparent
          onRequestClose={() => setRegionPickerOpen(false)}
        >
          <View style={[styles.modalBackdrop, { backgroundColor: scheme.overlay }]}>
            <View style={{ flex: 1, justifyContent: 'flex-end', paddingBottom: insets.bottom }}>
              <AppCard style={styles.modalCard} padding="six" elevation="lg">
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: scheme.text }]}>اختر المنطقة</Text>
                  <Pressable onPress={() => setRegionPickerOpen(false)}>
                    <Text style={{ color: scheme.primary, fontSize: FontSizes.base }}>إغلاق</Text>
                  </Pressable>
                </View>
                <FlatList
                  data={regions}
                  keyExtractor={(item) => item.id}
                  style={{ maxHeight: 420 }}
                  ItemSeparatorComponent={() => <View style={{ height: Spacing.two }} />}
                  renderItem={({ item }) => {
                    const isSelected = region?.id === item.id;
                    return (
                      <Pressable
                        onPress={() => {
                          setRegion(api.auth.getRegionById(item.id));
                          setRegionPickerOpen(false);
                          setErrors((p) => ({ ...p, region: null }));
                        }}
                        style={({ pressed }) => [
                          styles.regionItem,
                          {
                            backgroundColor: isSelected
                              ? `${scheme.primary}15`
                              : scheme.backgroundElement,
                            borderRadius: Radii.md,
                            padding: Spacing.four,
                            opacity: pressed ? 0.8 : 1,
                            borderWidth: BorderWidth.thin,
                            borderColor: isSelected ? scheme.primary : 'transparent',
                          },
                        ]}
                      >
                        <Text style={[{ color: scheme.text, fontSize: FontSizes.base }, isSelected && { fontWeight: FontWeights.bold }]}>
                          {item.name_ar}
                        </Text>
                        {isSelected ? <Ionicons name="checkmark" size={18} color={scheme.primary} /> : null}
                      </Pressable>
                    );
                  }}
                />
              </AppCard>
            </View>
          </View>
        </Modal>

        <Modal
          visible={avatarPickerOpen}
          animationType="slide"
          transparent
          onRequestClose={() => setAvatarPickerOpen(false)}
        >
          <View style={[styles.modalBackdrop, { backgroundColor: scheme.overlay }]}>
            <View style={{ flex: 1, justifyContent: 'flex-end', paddingBottom: insets.bottom }}>
              <AppCard style={styles.modalCard} padding="six" elevation="lg">
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: scheme.text }]}>{t('auth.register.avatarLabel')}</Text>
                  <Pressable onPress={() => setAvatarPickerOpen(false)}>
                    <Text style={{ color: scheme.primary, fontSize: FontSizes.base }}>إغلاق</Text>
                  </Pressable>
                </View>
                <View style={styles.avatarOptionsGroup}>
                  <Pressable
                    onPress={handlePickFromGallery}
                    style={({ pressed }) => [
                      styles.avatarOption,
                      {
                        backgroundColor: scheme.backgroundElement,
                        borderRadius: Radii.md,
                        opacity: pressed ? 0.8 : 1,
                      },
                    ]}
                  >
                    <Ionicons name="images" size={22} color={scheme.primary} />
                    <Text style={[styles.avatarOptionText, { color: scheme.text }]}>
                      {t('auth.register.avatarChooseGallery')}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={handleTakePhoto}
                    style={({ pressed }) => [
                      styles.avatarOption,
                      styles.avatarOptionMiddle,
                      {
                        backgroundColor: scheme.backgroundElement,
                        borderRadius: Radii.md,
                        opacity: pressed ? 0.8 : 1,
                      },
                    ]}
                  >
                    <Ionicons name="camera" size={22} color={scheme.primary} />
                    <Text style={[styles.avatarOptionText, { color: scheme.text }]}>
                      {t('auth.register.avatarTakePhoto')}
                    </Text>
                  </Pressable>
                  {avatar ? (
                    <Pressable
                      onPress={handleRemoveAvatar}
                      style={({ pressed }) => [
                        styles.avatarOption,
                        {
                          backgroundColor: `${scheme.danger}10`,
                          borderRadius: Radii.md,
                          opacity: pressed ? 0.8 : 1,
                        },
                      ]}
                    >
                      <Ionicons name="trash" size={22} color={scheme.danger} />
                      <Text style={[styles.avatarOptionText, { color: scheme.danger }]}>
                        {t('auth.register.avatarRemove')}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </AppCard>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </ScreenSafeArea>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    padding: Spacing.six,
    paddingTop: Spacing.six,
    flexGrow: 1,
  },
  headerRow: {
    marginBottom: Spacing.five,
    alignSelf: 'flex-start',
  },
  backText: {
    fontSize: FontSizes.base,
    fontWeight: FontWeights.semibold,
  },
  header: { marginBottom: Spacing.six },
  title: {
    fontSize: FontSizes['2xl'],
    fontWeight: FontWeights.bold,
    marginBottom: Spacing.two,
  },
  subtitle: { fontSize: FontSizes.base },
  form: { marginBottom: Spacing.six },
  pickerField: {
    width: '100%',
    marginBottom: Spacing.four,
  },
  pickerLabel: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.medium,
    marginBottom: Spacing.two,
    textAlign: 'right',
  },
  pickerBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    minHeight: 48,
  },
  pickerError: {
    fontSize: FontSizes.xs,
    marginTop: Spacing.one,
    textAlign: 'right',
  },
  avatarField: { width: '100%', marginBottom: Spacing.four },
  avatarBox: {
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
    flexDirection: 'column',
  },
  avatarImage: {
    width: 96,
    height: 96,
    borderRadius: Radii.full,
  },
  avatarPlaceholderContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarOptionsGroup: {
    width: '100%',
  },
  avatarOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.four,
  },
  avatarOptionMiddle: {
    marginVertical: Spacing.three,
  },
  avatarOptionText: {
    fontSize: FontSizes.base,
    fontWeight: FontWeights.medium,
    marginStart: Spacing.three,
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: Radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBox: {
    borderRadius: 12,
    padding: Spacing.four,
    marginTop: Spacing.three,
  },
  errorBoxText: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.medium,
    textAlign: 'right',
  },
  footer: {
    marginTop: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.four,
  },
  footerText: { fontSize: FontSizes.sm },
  footerAction: { fontSize: FontSizes.sm, fontWeight: FontWeights.bold },
  modalBackdrop: { flex: 1, padding: Spacing.four },
  modalCard: {
    borderTopStartRadius: Radii.xl,
    borderTopEndRadius: Radii.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.four,
  },
  modalTitle: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.bold,
  },
  regionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
