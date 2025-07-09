module.exports = {
  expo: {
    name: "smiya-mobile",
    slug: "smiya-mobile",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    owner: "smitvd22",
    splash: {
      backgroundColor: "#ffffff"
    },
    assetBundlePatterns: [
      "**/*"
    ],
    ios: {
      supportsTablet: true
    },
    android: {
      package: "com.smiya.app",
      permissions: ["CAMERA", "RECORD_AUDIO", "READ_EXTERNAL_STORAGE", "WRITE_EXTERNAL_STORAGE"]
    },
    web: {
      favicon: "./assets/favicon.png"
    },
    extra: {
      devServerIp: process.env.DEV_SERVER_IP || "192.168.1.2",
      eas: {
        projectId: "bd78b68d-2d50-4aad-a7f2-f84fb8977c86"
      }
    },
    plugins: [
      [
        "expo-image-picker",
        {
          "photosPermission": "The app accesses your photos to let you share them with your friends.",
          "cameraPermission": "The app accesses your camera to let you take photos to share with your friends."
        }
      ]
    ]
  }
};
