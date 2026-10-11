// ===============================================================
// شرح الملف: هذا صفحة تعديل ملف مقدم الخدمة.
// الهدف: توضيح وظيفة الملف ومهام الدوال دون تغيير منطق البرنامج.
// الدوال/الوظائف المعرّفة هنا: EditProviderProfileScreen، handleAddSkill، handleRemoveSkill، handleSave.
// ملاحظة: التعليقات التالية للشرح فقط؛ لا تغيّر سلوك الكود.
// ===============================================================

// ═══════════════════════════════════════════════════════════
// شاشة تعديل بروفايل مقدم الخدمة
// ═══════════════════════════════════════════════════════════

import { ScreenSafeArea } from '@/components/ui/ScreenSafeArea';
import { KEYBOARD_AVOIDING_BEHAVIOR } from '@/constants/keyboard';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppTextInput } from '@/components/ui/AppTextInput';
import { Colors, FontSizes, FontWeights, Radii, Spacing } from '@/constants/theme';
import { useOrder, type ProviderSkill } from '@/context/OrderContext';
import { DEFAULT_CITY } from '@/config/location';
import { useKeyboardVisible } from '@/hooks/use-keyboard-visible';
import { areaPlaceholder } from '@/domain/areaSuggestions';
import { usePreferredCity } from '@/hooks/use-preferred-city';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/ar';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import {
    KeyboardAvoidingView,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';

// [شرح الدالة: EditProviderProfileScreen] يعرض نموذج تعديل مهارات وبيانات ملف مقدم الخدمة.
const containsPhoneNumber = (value: string) => {
  const normalized = value
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)));
  return /[0-9](?:[\s()+\-./]*[0-9]){7,}/.test(normalized);
};

export default function EditProviderProfileScreen() {
  const theme = useTheme();
  const scheme = Colors[theme];
  const { myProviderProfile, updateProviderProfile, addFirstSkill, removeProviderSkill } = useOrder();

  const [newSkillName, setNewSkillName] = useState('');
  const { city: newSkillCity, setCity: setNewSkillCity, remember: rememberCity } = usePreferredCity();
  const [newSkillArea, setNewSkillArea] = useState('');
  const [showAddSkill, setShowAddSkill] = useState(false);
  const [saved, setSaved] = useState(false);
  const [addingSkill, setAddingSkill] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const keyboardVisible = useKeyboardVisible();
 const [skillCities, setSkillCities] = useState<Record<string, string>>({});
const [skillAreas, setSkillAreas] = useState<Record<string, string>>({});
  const [skillNames, setSkillNames] = useState<Record<string, string>>({});
  const [expandedSkillId, setExpandedSkillId] = useState<string | null>(null);

  const profile = myProviderProfile;

  useEffect(() => {
    if (!profile) return;
   setSkillCities(
  Object.fromEntries(
    profile.skills.map((skill) => [skill.id, skill.city ?? DEFAULT_CITY]),
  ),
);
setSkillAreas(
  Object.fromEntries(profile.skills.map((skill) => [skill.id, skill.area ?? ''])),
);
    setSkillNames(
      Object.fromEntries(profile.skills.map((skill) => [skill.id, skill.name])),
    );
  }, [profile?.skills]);

  // Guard
  if (!profile) {
    return (
      <ScreenSafeArea
        style={[styles.safe, { backgroundColor: scheme.background }]}
      >
        <View style={styles.errorWrap}>
          <Ionicons name="alert-circle" size={64} color={scheme.danger} />
          <Text style={[styles.errorText, { color: scheme.text }]}>
            ما عندك بروفايل مقدم خدمة بعد
          </Text>
          <AppButton
            title={t('home.becomeProvider.title')}
            variant="primary"
            size="md"
            onPress={() => router.replace('/orders/become-provider')}
          />
        </View>
      </ScreenSafeArea>
    );
  }

// [شرح الدالة: handleAddSkill] يضيف مهارة جديدة إلى قائمة مهارات مقدم الخدمة بعد التحقق منها.
  const handleAddSkill = async (): Promise<boolean> => {
    const trimmed = newSkillName.trim();
    const city = newSkillCity.trim();
    const area = newSkillArea.trim();

    if (!trimmed || !city || addingSkill) {
      if (!city) Alert.alert('المدينة مطلوبة', 'اكتب المدينة التي تقدم فيها الخدمة.');
      return false;
    }

    if (containsPhoneNumber(city) || containsPhoneNumber(area)) {
      Alert.alert('رقم الهاتف غير مسموح', 'لا تضع رقم هاتف في حقل المدينة أو المنطقة.');
      return false;
    }

    setAddingSkill(true);
    try {
      const result = await addFirstSkill({
        id: `skill_${Date.now()}`,
        name: trimmed,
        description: trimmed,
        city,
        area,
        service_area: [city, area].filter(Boolean).join(' '),
        additional_info: '',
      });

      if (result.error) {
        Alert.alert('تعذر حفظ المهارة', result.error);
        return false;
      }

      rememberCity(city);
      setNewSkillName('');
      setNewSkillArea('');
      setShowAddSkill(false);
      return true;
    } catch (error) {
      Alert.alert(
        'تعذر حفظ المهارة',
        error instanceof Error ? error.message : 'حدث خطأ غير متوقع. حاول مرة أخرى.',
      );
      return false;
    } finally {
      setAddingSkill(false);
    }
  };

// [شرح الدالة: handleRemoveSkill] يحذف مهارة محددة من قائمة المهارات.
  const handleRemoveSkill = async (skillId: string) => {
    const result = await removeProviderSkill(skillId);
    if (!result.ok) {
      Alert.alert('تعذر حذف المهارة', result.error ?? 'لم يتم حذف المهارة. حاول مرة أخرى.');
    }
  };

// [شرح الدالة: handleSave] يحفظ التعديلات الحالية ويرسلها إلى طبقة البيانات.
  const handleSave = async () => {
    const hasPhoneInBio = containsPhoneNumber(profile.bio ?? '');
    const hasPhoneInSkillLocation = profile.skills.some((skill) =>
      containsPhoneNumber(skillCities[skill.id] ?? skill.city ?? DEFAULT_CITY) ||
      containsPhoneNumber(skillAreas[skill.id] ?? skill.area ?? ''),
    );
    const hasPhoneInNewLocation =
      showAddSkill &&
      (containsPhoneNumber(newSkillCity) || containsPhoneNumber(newSkillArea));

    if (hasPhoneInBio || hasPhoneInSkillLocation || hasPhoneInNewLocation) {
      Alert.alert(
        'رقم الهاتف غير مسموح',
        'احذف رقم الهاتف من نبذة عنك أو من حقل المدينة أو المنطقة قبل الحفظ.',
      );
      return;
    }

    updateProviderProfile({
      skills: profile.skills.map((skill) => ({
        ...skill,
        name: skillNames[skill.id] ?? skill.name,
      city: skillCities[skill.id] ?? skill.city ?? DEFAULT_CITY,
area: skillAreas[skill.id] ?? skill.area ?? '',
service_area: [
  skillCities[skill.id] ?? skill.city ?? DEFAULT_CITY,
  skillAreas[skill.id] ?? skill.area ?? '',
]
  .filter(Boolean)
  .join(' '),
      })),
    });

    // إذا كتب المستخدم مهارة جديدة ولم يضغط "إضافة"، نضيفها الآن بدل أن تضيع بصمت.
    // (نحفظ تعديلات المهارات الحالية أولاً، ثم الإضافة تعيد تحميل القائمة من قاعدة البيانات.)
    if (showAddSkill && newSkillName.trim()) {
      const added = await handleAddSkill();
      if (!added) return;
    }

    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      router.back();
    }, 1200);
  };

  return (
    <ScreenSafeArea
      style={[styles.safe, { backgroundColor: scheme.background }]}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={KEYBOARD_AVOIDING_BEHAVIOR}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="arrow-forward" size={26} color={scheme.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: scheme.text }]}>
            {t('home.editProfile.title')}
          </Text>
          <View style={{ width: 26 }} />
        </View>

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {/* Skills */}
          <AppCard padding="four" elevation="sm" style={styles.card}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: scheme.text }]}>
                {t('home.editProfile.skillsSection')}
              </Text>
              <Pressable
                onPress={() => {
                  setShowAddSkill(true);
                  scrollRef.current?.scrollTo({ y: 0, animated: true });
                }}
                hitSlop={6}
              >
                <Ionicons name="add-circle" size={26} color={scheme.primary} />
              </Pressable>
            </View>

            {/* Add Skill Form: فوق قائمة المهارات حتى يظهر زر "إضافة" أول شي ولا تغطيه لوحة المفاتيح */}
            {showAddSkill && (
              <View
                style={[
                  styles.addSkillForm,
                  { borderColor: scheme.primary, backgroundColor: scheme.backgroundElement },
                ]}
              >
                <AppTextInput
                  placeholder="اسم المهارة الجديدة"
                  value={newSkillName}
                  onChangeText={setNewSkillName}
                  autoFocus
                />
                <View style={styles.fieldsRow}>
                  <AppTextInput
                    label="المدينة"
                    placeholder="مثال: اللاذقية"
                    value={newSkillCity}
                    onChangeText={setNewSkillCity}
                    onBlur={() => rememberCity()}
                    containerStyle={styles.rowField}
                  />
                  <AppTextInput
                    label="المنطقة (اختياري)"
                    placeholder={areaPlaceholder(newSkillCity)}
                    value={newSkillArea}
                    onChangeText={setNewSkillArea}
                    containerStyle={styles.rowField}
                  />
                </View>
                <View style={styles.addSkillActions}>
                  <AppButton
                    title={addingSkill ? "جارٍ الحفظ..." : "إضافة"}
                    variant="primary"
                    size="sm"
                    onPress={handleAddSkill}
                    disabled={addingSkill}
                    fullWidth={false}
                    style={{ flex: 1 }}
                  />
                  <AppButton
                    title="إلغاء"
                    variant="secondary"
                    size="sm"
                    onPress={() => {
                      setShowAddSkill(false);
                      setNewSkillName('');
                      setNewSkillArea('');
                    }}
                    fullWidth={false}
                    style={{ flex: 1, marginStart: Spacing.two }}
                  />
                </View>
              </View>
            )}

            {/* Skills List */}
            {profile.skills.map((skill) => {
              const isExpanded = expandedSkillId === skill.id;
              const city = skillCities[skill.id] ?? skill.city ?? DEFAULT_CITY;
              const area = skillAreas[skill.id] ?? skill.area ?? '';

              return (
                <Pressable
                  key={skill.id}
                  onPress={() =>
                    setExpandedSkillId(isExpanded ? null : skill.id)
                  }
                  style={[
                    styles.skillRow,
                    { backgroundColor: scheme.backgroundElement, borderColor: scheme.border },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    {!isExpanded ? (
                      <>
                        <Text style={[styles.skillName, { color: scheme.text }]}>
                          {skillNames[skill.id] ?? skill.name}
                        </Text>
                        <Text style={[styles.skillMeta, { color: scheme.textSecondary }]}>
                          {'📍 ' + city + (area ? ' — ' + area : '')}
                        </Text>
                      </>
                    ) : (
                      <>
                        <AppTextInput
                          label="المهارة"
                          placeholder="مثال: مدرس لغة ألمانية"
                          value={skillNames[skill.id] ?? skill.name}
                          onChangeText={(value) =>
                            setSkillNames((prev) => ({ ...prev, [skill.id]: value }))
                          }
                          containerStyle={styles.serviceAreaInput}
                        />
                        <View style={styles.fieldsRow}>
                        <AppTextInput
                          label="المدينة"
                          placeholder="مثال: اللاذقية"
                          value={city}
                          onChangeText={(value) =>
                            setSkillCities((prev) => ({ ...prev, [skill.id]: value }))
                          }
                          onBlur={() => rememberCity(city)}
                          containerStyle={styles.rowField}
                        />
                        <AppTextInput
                          label="المنطقة (اختياري)"
                          placeholder={areaPlaceholder(city)}
                          value={area}
                          onChangeText={(value) =>
                            setSkillAreas((prev) => ({ ...prev, [skill.id]: value }))
                          }
                          containerStyle={styles.rowField}
                        />
                        </View>
                        {(skill.years_of_experience ?? 0) > 0 && (
                          <Text style={[styles.skillMeta, { color: scheme.textSecondary }]}>
                            {skill.years_of_experience} سنوات خبرة
                          </Text>
                        )}
                      </>
                    )}
                  </View>

                  <Pressable
                    onPress={() => handleRemoveSkill(skill.id)}
                    hitSlop={6}
                  >
                    <Ionicons name="trash-outline" size={20} color={scheme.danger} />
                  </Pressable>
                </Pressable>
              );
            })}
          </AppCard>

          {/* Bio */}
          <AppCard padding="four" elevation="sm" style={styles.card}>
            <Text style={[styles.sectionTitle, { color: scheme.text }]}>
              {t('home.becomeProvider.bioLabel')}
            </Text>
            <AppTextInput
              placeholder={t('home.becomeProvider.bioPlaceholder')}
              value={profile.bio ?? ''}
              onChangeText={(v) => {
                if (containsPhoneNumber(v)) {
                  Alert.alert('رقم الهاتف غير مسموح', 'لا تضع رقم هاتف في نبذة عنك.');
                  return;
                }
                updateProviderProfile({ bio: v });
              }}
              multiline
              numberOfLines={3}
              style={{ minHeight: 80, textAlignVertical: 'top' }}
            />
          </AppCard>
        </ScrollView>

        {/* Save: يُخفى أثناء ظهور لوحة المفاتيح حتى لا يطفو فوقها ويُضغط قبل "إضافة" */}
        {!keyboardVisible && (
        <View style={styles.footer}>
          {saved ? (
            <View style={[styles.savedBadge, { backgroundColor: `${scheme.success}15` }]}>
              <Ionicons name="checkmark-circle" size={20} color={scheme.success} />
              <Text style={[styles.savedText, { color: scheme.success }]}>
                {t('home.editProfile.savedMessage')}
              </Text>
            </View>
          ) : (
            <AppButton
              title={t('home.editProfile.saveBtn')}
              variant="primary"
              size="lg"
              onPress={handleSave}
              leadingIcon={
                <Ionicons name="checkmark" size={20} color={scheme.primaryContrast} />
              }
            />
          )}
        </View>
        )}
      </KeyboardAvoidingView>
    </ScreenSafeArea>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  headerTitle: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.bold,
    writingDirection: 'rtl',
  },
  content: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.eight,
  },
  card: {
    marginBottom: Spacing.three,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.three,
  },
  sectionTitle: {
    fontSize: FontSizes.base,
    fontWeight: FontWeights.semibold,
    writingDirection: 'rtl',
  },
  hint: {
    fontSize: FontSizes.xs,
    writingDirection: 'rtl',
    marginTop: Spacing.one,
  },
  skillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: Radii.md,
    borderWidth: 1,
    marginBottom: Spacing.three,
    gap: Spacing.three,
  },
  skillName: {
    fontSize: FontSizes.base,
    fontWeight: FontWeights.medium,
    writingDirection: 'rtl',
  },
  serviceAreaInput: {
    marginTop: Spacing.one,
    marginBottom: 0,
  },
  fieldsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  rowField: {
    flex: 1,
  },
  skillMeta: {
    fontSize: FontSizes.xs,
    writingDirection: 'rtl',
    marginTop: 2,
  },
  addSkillForm: {
    borderWidth: 1,
    borderRadius: Radii.md,
    padding: Spacing.three,
    marginBottom: Spacing.three,
    gap: Spacing.one,
  },
  addSkillActions: {
    flexDirection: 'row',
  },
  footer: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.four,
    paddingTop: Spacing.two,
  },
  savedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.four,
    borderRadius: Radii.lg,
  },
  savedText: {
    fontSize: FontSizes.base,
    fontWeight: FontWeights.semibold,
    writingDirection: 'rtl',
  },
  errorWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.four,
    padding: Spacing.six,
  },
  errorText: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.bold,
    writingDirection: 'rtl',
    textAlign: 'center',
  },
});