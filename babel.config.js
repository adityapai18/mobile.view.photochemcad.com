module.exports = function (api) {
   api.cache(true);
   return {
     presets: ['babel-preset-expo'],
     plugins: [
       // Required for expo-router
       'react-native-reanimated/plugin', // 👈🏼 add this as the LAST item in plugins
     ],
   };
 };