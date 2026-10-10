import React from 'react';

/**
 * 各视图对应页面的动态 import。
 *
 * 为什么要单独放一份，而不是直接写在 App.jsx 的 lazy() 里：
 * 切视图时会先把目标页面的代码取回来再开始扫掠，否则扫掠揭开的是 Suspense
 * 的「加载中」占位，等代码到了内容才突然出现，很难看。
 *
 * 注意 `library` 不在表里 —— 它是首屏就加载的，没有独立 chunk。
 */
export const VIEW_CHUNK_LOADERS = {
  video: () => import('../components/VideoPage.jsx'),
  download: () => import('../components/DownloadPage.jsx'),
  resources: () => import('../components/ResourcesPage.jsx'),
  archive: () => import('../components/NanjingLizhiArchivePage.jsx'),
  gallery: () => import('../components/GalleryDisplayPage.jsx'),
  about: () => import('../components/AboutPage.jsx'),
  app: () => import('../components/AppPage.jsx'),
  support: () => import('../components/SupportPage.jsx'),
  admin: () => import('../components/AdminPage.jsx'),
  comment: () => import('../components/CommentPage.jsx')
};

/** view -> 已经解析出来的页面组件 */
const resolvedComponents = new Map();
/** view -> 正在进行中的加载（同一个页面不会重复请求） */
const pendingLoads = new Map();

/**
 * 取回某个视图的页面组件，并把结果记下来供同步渲染用。
 * @returns {Promise<React.ComponentType|null>}
 */
export const loadViewComponent = (view) => {
  const loader = VIEW_CHUNK_LOADERS[view];
  if (!loader) return Promise.resolve(null);
  if (!pendingLoads.has(view)) {
    pendingLoads.set(
      view,
      loader().then((module) => {
        const component = module.default ?? module;
        resolvedComponents.set(view, component);
        return component;
      })
    );
  }
  return pendingLoads.get(view);
};

/**
 * 用法跟 React.lazy 一样，但模块已经预取好时会「同步」渲染出真正的页面。
 *
 * 为什么需要它：React.lazy 的模块解析发生在组件首次渲染之后 —— 就算代码早已
 * 预取到本地，第一次渲染仍会先落到 Suspense 占位上（实测约 300ms）。
 * 切视图前会 await loadViewComponent()，这里就能直接拿到组件同步渲染，
 * 扫掠揭开的就是真页面，不会露出「加载中」。
 *
 * 直接打开某个深链（比如刷新在 /video）时没有预取，这时退回 React.lazy，
 * 行为跟以前完全一致。
 */
export const createViewComponent = (view) => {
  const LazyView = React.lazy(() =>
    loadViewComponent(view).then((component) => ({ default: component }))
  );

  const ViewComponent = (props) => {
    const Resolved = resolvedComponents.get(view);
    if (Resolved) return React.createElement(Resolved, props);
    return React.createElement(LazyView, props);
  };
  ViewComponent.displayName = `View(${view})`;
  return ViewComponent;
};
