export const CHANNELS = {
  STEAM_SCAN: 'steam:scan',
  STEAM_GAMES: 'steam:games',
  STEAM_IMPORT_LUA: 'steam:importLua',
  STEAM_DOWNLOAD_LUA: 'steam:downloadLua',
  STEAM_DOWNLOAD_LUA_BATCH: 'steam:downloadLuaBatch',
  STEAM_CLEAR_LIBRARY: 'steam:clearLibrary',
  STEAM_ADD_TOOLS: 'steam:addToSteamTools',
  STEAM_REMOVE: 'steam:remove',
  STEAM_IS_RUNNING: 'steam:isRunning',
  STEAM_DETECT_PATH: 'steam:detectPath',

  DLC_LIST: 'dlc:list',
  DLC_TOGGLE: 'dlc:toggle',
  DLC_REBUILD_PLUGIN: 'dlc:rebuildPlugin',
  DLC_GENERATE: 'dlc:generate',

  FEED_GET: 'feed:get',
  FEED_POST: 'feed:post',
  FEED_DELETE: 'feed:delete',
  FEED_REACT: 'feed:react',
  FEED_PUSH: 'feed:push',

  APP_CHECK_UPDATES: 'app:checkUpdates',
  APP_OPEN_RELEASE: 'app:openRelease',
  APP_GET_CHANGELOG: 'app:getChangelog',

  SETTINGS_GET: 'settings:get',
  SETTINGS_GET_AVATAR: 'settings:getAvatar',
  SETTINGS_SET: 'settings:set',
  SETTINGS_PICK_AVATAR: 'settings:pickAvatar',
  SETTINGS_VERIFY_OWNER_KEY: 'settings:verifyOwnerKey'
} as const

export type Channel = typeof CHANNELS[keyof typeof CHANNELS]
