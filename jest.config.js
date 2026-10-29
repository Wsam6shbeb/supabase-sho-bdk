// إعداد اختبارات الوحدة/المكوّنات عبر jest-expo.
// ملاحظة: jest-expo يشتقّ خريطة المسارات (@/*) تلقائياً من tsconfig.json،
// لذلك لا حاجة لإعداد moduleNameMapper يدوياً.
/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/?(*.)+(test).[jt]s?(x)'],
  clearMocks: true,
  // مهلة أطول: أول عرض لقائمة FlatList في بيئة الاختبار يستغرق ثوانيَ قليلة
  testTimeout: 20000,
  moduleNameMapper: {
    // نتجاهل ملفات الأنماط في بيئة الاختبار (لا معنى لتحويل CSS في Jest)
    '\\.css$': '<rootDir>/jest/style-mock.js',
  },
};
