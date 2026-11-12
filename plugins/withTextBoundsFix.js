const { withAndroidStyles } = require('expo/config-plugins');

const APP_THEME = 'AppTheme';
const TEXT_VIEW_STYLE = 'Widget.App.TextView';

module.exports = (config) =>
  withAndroidStyles(config, (config) => {
    const styles = config.modResults;
    styles.resources = styles.resources || {};
    styles.resources.style = styles.resources.style || [];

    let textViewStyle = styles.resources.style.find(
      (style) => style?.$?.name === TEXT_VIEW_STYLE,
    );

    if (!textViewStyle) {
      textViewStyle = {
        $: {
          name: TEXT_VIEW_STYLE,
          parent: 'Widget.AppCompat.TextView',
        },
        item: [],
      };
      styles.resources.style.push(textViewStyle);
    }

    textViewStyle.item = textViewStyle.item || [];
    const boundsItem = textViewStyle.item.find(
      (item) => item?.$?.name === 'android:useBoundsForWidth',
    );

    if (boundsItem) {
      boundsItem._ = 'false';
    } else {
      textViewStyle.item.push({
        $: { name: 'android:useBoundsForWidth' },
        _: 'false',
      });
    }

    const appTheme = styles.resources.style.find(
      (style) => style?.$?.name === APP_THEME,
    );

    if (appTheme) {
      appTheme.item = appTheme.item || [];
      const textViewStyleItem = appTheme.item.find(
        (item) => item?.$?.name === 'android:textViewStyle',
      );

      if (textViewStyleItem) {
        textViewStyleItem._ = `@style/${TEXT_VIEW_STYLE}`;
      } else {
        appTheme.item.push({
          $: { name: 'android:textViewStyle' },
          _: `@style/${TEXT_VIEW_STYLE}`,
        });
      }
    }

    return config;
  });
