const { AndroidConfig, withAndroidManifest, withXcodeProject } = require('expo/config-plugins');

module.exports = function withRevenueCat(config) {
  config = withAndroidManifest(config, config => {
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(config.modResults);
    // A banking-app verification round trip must not cancel a Play purchase.
    activity.$['android:launchMode'] = 'singleTop';
    return config;
  });
  return withXcodeProject(config, config => {
    const project = config.modResults.getFirstProject().firstProject;
    const targetId = config.modResults.getFirstTarget().uuid;
    project.attributes ??= {};
    project.attributes.TargetAttributes ??= {};
    const target = project.attributes.TargetAttributes[targetId] ??= {};
    target.SystemCapabilities ??= {};
    target.SystemCapabilities['com.apple.InAppPurchase'] = { enabled: 1 };
    return config;
  });
};
