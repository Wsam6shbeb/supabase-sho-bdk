// Keep cleartext HTTP available for local development only.
// EAS sets EAS_BUILD_PROFILE to development, preview, or production.
module.exports = ({ config }) => {
  const profile = process.env.EAS_BUILD_PROFILE;
  const allowCleartextTraffic = !profile || profile === "development";

  const plugins = (config.plugins || []).map((plugin) => {
    if (Array.isArray(plugin) && plugin[0] === "expo-build-properties") {
      return [
        plugin[0],
        {
          ...(plugin[1] || {}),
          android: {
            ...((plugin[1] && plugin[1].android) || {}),
            usesCleartextTraffic: allowCleartextTraffic,
          },
        },
      ];
    }

    return plugin;
  });

  return {
    ...config,
    plugins,
  };
};
