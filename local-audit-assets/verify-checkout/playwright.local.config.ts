import config from './playwright.config';
export default { ...config, use: { ...config.use, video: 'off' }, projects: config.projects?.map((project) => ({ ...project, use: { ...project.use, channel: 'chrome', video: 'off' } })) };
