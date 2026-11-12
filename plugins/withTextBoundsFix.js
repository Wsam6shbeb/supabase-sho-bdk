const { withAndroidStyles } = require('expo/config-plugins');
module.exports = (config) =>
  withAndroidStyles(config, (config) => {
    const theme = config.modResults.resources.style.find((s) => s.$.name === 'AppTheme');
    if (theme) {
      theme.item = theme.item || [];
      if (!theme.item.some((i) => i.$.name === 'android:useBoundsForWidth')) {
        theme.item.push({ $: { name: 'android:useBoundsForWidth' }, _: 'false' });
      }
    }
    return config;
  });
