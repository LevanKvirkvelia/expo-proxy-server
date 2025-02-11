export type Manifest = {
  id: string;
  createdAt: string;
  runtimeVersion: string;
  launchAsset: {
    key: string;
    contentType: string;
    url: string;
  };
  assets: Array<any>;
  metadata: {};
  extra: {
    eas: {};
    expoClient: {
      name: string;
      slug: string;
      version: string;
      orientation: string;
      icon: string;
      scheme: string;
      userInterfaceStyle: string;
      newArchEnabled: boolean;
      ios: {
        supportsTablet: boolean;
      };
      android: {
        adaptiveIcon: {
          foregroundImage: string;
          backgroundColor: string;
          foregroundImageUrl: string;
        };
      };
      web: {
        bundler: string;
        output: string;
        favicon: string;
      };
      plugins: [
        string,
        [
          string,
          {
            image: string;
            imageWidth: number;
            resizeMode: string;
            backgroundColor: string;
          },
        ],
      ];
      experiments: {
        typedRoutes: boolean;
      };
      _internal: {
        isDebug: boolean;
        projectRoot: string;
        dynamicConfigPath: {};
        staticConfigPath: string;
        packageJsonPath: string;
        pluginHistory: {
          "expo-splash-screen": {
            name: string;
            version: string;
          };
        };
      };
      sdkVersion: string;
      platforms: Array<string>;
      extra: {
        router: {
          origin: boolean;
        };
      };
      androidStatusBar: {
        backgroundColor: string;
      };
      iconUrl: string;
      hostUri: string;
    };
    expoGo: {
      debuggerHost: string;
      developer: {
        tool: string;
        projectRoot: string;
      };
      packagerOpts: {
        dev: boolean;
      };
      mainModuleName: string;
      __flipperHack: string;
    };
    scopeKey: string;
  };
};
