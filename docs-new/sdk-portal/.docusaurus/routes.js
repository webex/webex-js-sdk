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
    component: ComponentCreator('/docs', 'b51'),
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
        path: '/docs/Web/advancedFeature/Ad-hoc-Space-Meetings',
        component: ComponentCreator('/docs/Web/advancedFeature/Ad-hoc-Space-Meetings', '48f'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/Web/advancedFeature/create-a-document',
        component: ComponentCreator('/docs/Web/advancedFeature/create-a-document', '7fd'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/Web/advancedFeature/deploy-your-site',
        component: ComponentCreator('/docs/Web/advancedFeature/deploy-your-site', '95f'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/Web/advancedFeature/effects',
        component: ComponentCreator('/docs/Web/advancedFeature/effects', 'ffa'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/Web/advancedFeature/mediaQuality',
        component: ComponentCreator('/docs/Web/advancedFeature/mediaQuality', 'ebb'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/Web/advancedFeature/meetingFeature',
        component: ComponentCreator('/docs/Web/advancedFeature/meetingFeature', '7a2'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/Web/advancedFeature/TLS-443-Support',
        component: ComponentCreator('/docs/Web/advancedFeature/TLS-443-Support', '3d2'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/Web/advancedFeature/Unified-Space-Meetings-(USM)',
        component: ComponentCreator('/docs/Web/advancedFeature/Unified-Space-Meetings-(USM)', 'e0b'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/Web/basicFeature/Background-Noise-Reduction',
        component: ComponentCreator('/docs/Web/basicFeature/Background-Noise-Reduction', 'f70'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/Web/basicFeature/create-a-blog-post',
        component: ComponentCreator('/docs/Web/basicFeature/create-a-blog-post', 'ad6'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/Web/basicFeature/create-a-page',
        component: ComponentCreator('/docs/Web/basicFeature/create-a-page', 'e84'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/Web/basicFeature/guestIssuer',
        component: ComponentCreator('/docs/Web/basicFeature/guestIssuer', '48a'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/Web/basicFeature/joinMeeting',
        component: ComponentCreator('/docs/Web/basicFeature/joinMeeting', '1b3'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/Web/basicFeature/Password---Captcha-Flow-in-Web-JS-SDK',
        component: ComponentCreator('/docs/Web/basicFeature/Password---Captcha-Flow-in-Web-JS-SDK', '50f'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/Web/basicFeature/schedulemeeting',
        component: ComponentCreator('/docs/Web/basicFeature/schedulemeeting', 'e17'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/Web/basicFeature/screenshare',
        component: ComponentCreator('/docs/Web/basicFeature/screenshare', 'c40'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/Web/basicFeature/token',
        component: ComponentCreator('/docs/Web/basicFeature/token', 'e16'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/Web/basicFeature/trackmanagement',
        component: ComponentCreator('/docs/Web/basicFeature/trackmanagement', 'e83'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/Web/basicFeature/Webex-Transcription',
        component: ComponentCreator('/docs/Web/basicFeature/Webex-Transcription', 'a3c'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/Web/introduction',
        component: ComponentCreator('/docs/Web/introduction', '134'),
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
