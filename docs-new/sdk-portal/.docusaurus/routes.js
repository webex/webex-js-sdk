import React from 'react';
import ComponentCreator from '@docusaurus/ComponentCreator';

export default [
  {
    path: '/__docusaurus/debug',
    component: ComponentCreator('/__docusaurus/debug', '703'),
    exact: true
  },
  {
    path: '/__docusaurus/debug/config',
    component: ComponentCreator('/__docusaurus/debug/config', '47e'),
    exact: true
  },
  {
    path: '/__docusaurus/debug/content',
    component: ComponentCreator('/__docusaurus/debug/content', 'e7f'),
    exact: true
  },
  {
    path: '/__docusaurus/debug/globalData',
    component: ComponentCreator('/__docusaurus/debug/globalData', '990'),
    exact: true
  },
  {
    path: '/__docusaurus/debug/metadata',
    component: ComponentCreator('/__docusaurus/debug/metadata', 'c5f'),
    exact: true
  },
  {
    path: '/__docusaurus/debug/registry',
    component: ComponentCreator('/__docusaurus/debug/registry', '875'),
    exact: true
  },
  {
    path: '/__docusaurus/debug/routes',
    component: ComponentCreator('/__docusaurus/debug/routes', '846'),
    exact: true
  },
  {
    path: '/blog',
    component: ComponentCreator('/blog', 'dba'),
    exact: true
  },
  {
    path: '/blog/archive',
    component: ComponentCreator('/blog/archive', 'e0b'),
    exact: true
  },
  {
    path: '/blog/first-blog-post',
    component: ComponentCreator('/blog/first-blog-post', '44b'),
    exact: true
  },
  {
    path: '/blog/long-blog-post',
    component: ComponentCreator('/blog/long-blog-post', '5db'),
    exact: true
  },
  {
    path: '/blog/mdx-blog-post',
    component: ComponentCreator('/blog/mdx-blog-post', 'f91'),
    exact: true
  },
  {
    path: '/blog/tags',
    component: ComponentCreator('/blog/tags', '491'),
    exact: true
  },
  {
    path: '/blog/tags/docusaurus',
    component: ComponentCreator('/blog/tags/docusaurus', '8f0'),
    exact: true
  },
  {
    path: '/blog/tags/facebook',
    component: ComponentCreator('/blog/tags/facebook', '6c8'),
    exact: true
  },
  {
    path: '/blog/tags/hello',
    component: ComponentCreator('/blog/tags/hello', 'ce8'),
    exact: true
  },
  {
    path: '/blog/tags/hola',
    component: ComponentCreator('/blog/tags/hola', '415'),
    exact: true
  },
  {
    path: '/blog/welcome',
    component: ComponentCreator('/blog/welcome', 'f7e'),
    exact: true
  },
  {
    path: '/markdown-page',
    component: ComponentCreator('/markdown-page', '741'),
    exact: true
  },
  {
    path: '/docs',
    component: ComponentCreator('/docs', '2a3'),
    routes: [
      {
        path: '/docs/authorization',
        component: ComponentCreator('/docs/authorization', 'c3e'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/category/advanced-feature',
        component: ComponentCreator('/docs/category/advanced-feature', '89b'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/category/basic-feature',
        component: ComponentCreator('/docs/category/basic-feature', '46e'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/developer-account',
        component: ComponentCreator('/docs/developer-account', '7d5'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/intro',
        component: ComponentCreator('/docs/intro', 'aed'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/use-case',
        component: ComponentCreator('/docs/use-case', '521'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/Web/advanced-feature/congratulations',
        component: ComponentCreator('/docs/Web/advanced-feature/congratulations', '78a'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/Web/advanced-feature/create-a-document',
        component: ComponentCreator('/docs/Web/advanced-feature/create-a-document', 'a53'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/Web/advanced-feature/deploy-your-site',
        component: ComponentCreator('/docs/Web/advanced-feature/deploy-your-site', '18f'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/Web/basic-feature/create-a-blog-post',
        component: ComponentCreator('/docs/Web/basic-feature/create-a-blog-post', '9f7'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/Web/basic-feature/create-a-page',
        component: ComponentCreator('/docs/Web/basic-feature/create-a-page', '1df'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/Web/markdown-features',
        component: ComponentCreator('/docs/Web/markdown-features', 'e0b'),
        exact: true,
        sidebar: "tutorialSidebar"
      }
    ]
  },
  {
    path: '/',
    component: ComponentCreator('/', '4df'),
    exact: true
  },
  {
    path: '*',
    component: ComponentCreator('*'),
  },
];
