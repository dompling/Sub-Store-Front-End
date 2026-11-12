import { defineStore } from 'pinia';

export const SIDEBAR_BREAKPOINT = 768;
export const SIDEBAR_EXPANDED_BREAKPOINT = 1220;

type NavigatorWithStandalone = Navigator & {
  standalone?: boolean;
};

const isAppleStandalonePWA = () => {
  const navigatorWithStandalone = navigator as NavigatorWithStandalone;

  return (
    (navigatorWithStandalone.standalone ||
      window.matchMedia("(display-mode: standalone)").matches) &&
    !/Android/.test(navigator.userAgent)
  ) || false;
};

const isIPadLike = () =>
  /iPad/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

const isSmallSafeAreaDevice = () =>
  window.innerHeight < 750 || isIPadLike();

const shouldUsePwaTopInset = (state: SystemStoreState) =>
  state.isPWA && (!state.isLandscape || state.isIPadLike);

export const useSystemStore = defineStore('systemStore', {
  state: () => {
    return {
      isPWA: isAppleStandalonePWA(),
      isLandscape: window.innerWidth > window.innerHeight,
      isIPadLike: isIPadLike(),
      isSmall: isSmallSafeAreaDevice(),
      screenWidth: window.innerWidth,
      screenHeight: window.innerHeight,
      statusBarHeight: 0
    };
  },
  getters: {
    navBarHeight: (state) => {
      return shouldUsePwaTopInset(state) ? (state.isSmall ? "78px" : "125px") : "56px";
    },
    navBartop: (state) => {
      return shouldUsePwaTopInset(state) ? (state.isSmall ? "38px" : "85px") : "0px";
    },
    navActionOffset: (state) => {
      const navBarHeightNum = shouldUsePwaTopInset(state) ? (state.isSmall ? 78 : 125) : 56;
      const navBarTopNum = shouldUsePwaTopInset(state) ? (state.isSmall ? 38 : 85) : 0;

      return `${(navBarHeightNum + navBarTopNum) / 2}px`;
    },
    navBartopRight: (state) => {
      return shouldUsePwaTopInset(state) ? (state.isSmall ? "52px" : "95px") : "15px";
    },
    pwaTopPadding: (state) => {
      return shouldUsePwaTopInset(state) ? (state.isSmall ? "20px" : "75px") : "0px";
    }
  },
  actions: {
    handleResize() {
      this.screenWidth = window.innerWidth;
      this.screenHeight = window.innerHeight;
      this.isIPadLike = isIPadLike();
      this.isSmall = isSmallSafeAreaDevice();
      this.isLandscape = this.screenWidth > this.screenHeight;
      // console.log(`isPWA: ${this.isPWA}, Screen resized: ${this.screenWidth}x${this.screenHeight}, isSmall: ${this.isSmall}, isLandscape: ${this.isLandscape}`);
    },
    setStatusBarHeight(height: number) {
      this.statusBarHeight = height;
    },
    setIsPWA(isPWA: boolean) {
      this.isPWA = isPWA;
    },
    initSystemState() {
      this.isPWA = isAppleStandalonePWA();
      this.handleResize();
      
      // 监听屏幕尺寸变化
      window.addEventListener("resize", () => this.handleResize());
    }
  },
});
