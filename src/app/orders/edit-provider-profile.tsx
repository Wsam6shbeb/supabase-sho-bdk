// ===============================================================
// شرح الملف: هذا صفحة تعديل ملف مقدم الخدمة.
// الهدف: توضيح وظيفة الملف ومهام الدوال دون تغيير منطق البرنامج.
// الدوال/الوظائف المعرّفة هنا: EditProviderProfileScreen، handleAddSkill، handleRemoveSkill، handleSave.
// ملاحظة: التعليقات التالية للشرح فقط؛ لا تغيّر سلوك الكود.
// ===============================================================

// ═══════════════════════════════════════════════════════════
// شاشة تعديل بروفايل مقدم الخدمة
// ═══════════════════════════════════════════════════════════

import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppTextInput } from '@/components/ui/AppTextInput';
import { Colors, FontSizes, FontWeights, Radii, Spacing } from '@/constants/theme';
import { useOrder, type ProviderSkill } from '@/context/OrderContext';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/ar';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// [شرح الدالة: EditProviderProfileScreen] يعرض نموذج تعديل مهارات وبيانات ملف مقدم الخدمة.
export default function EditProviderProfileScreen() {
  const theme = useTheme();
  const scheme = Colors[theme];
  const { myProviderProfile, updateProviderProfile } = useOrder();

  const [newSkillName, setNewSkillName] = useState('');
  const [showAddSkill, setShowAddSkill] = useState(false);
  const [saved, setSaved] = useState(false);

  const profile = myProviderProfile;

  // Guard
  if (!profile) {
    return (
      <SafeAreaView
        style={[styles.safe, { backgroundColor: scheme.background }]}
        edges={['top']}
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
      </SafeAreaView>
    );
  }

// [شرح الدالة: handleAddSkill] يضيف مهارة جديدة إلى قائمة مهارات مقدم الخدمة بعد التحقق منها.
  const handleAddSkill = () => {
    const trimmed = newSkillName.trim();
    if (!trimmed) return;

    const newSkill: ProviderSkill = {
      id: `skill_${Date.now()}`,
      name: trimmed,
    };

    updateProviderProfile({
      skills: [...profile.skills, newSkill],
    });

    setNewSkillName('');
    setShowAddSkill(false);
  };

// [شرح الدالة: handleRemoveSkill] يحذف مهارة محددة من قائمة المهارات.
  const handleRemoveSkill = (skillId: string) => {
    updateProviderProfile({
      skills: profile.skills.filter((s) => s.id !== skillId),
    });
  };

// [شرح الدالة: handleSave] يحفظ التعديلات الحالية ويرسلها إلى طبقة البيانات.
  const handleSave = () => {
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      router.back();
    }, 1200);
  };

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: scheme.background }]}
      edges={['top']}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* Skills */}
          <AppCard padding="four" elevation="sm" style={styles.card}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: scheme.text }]}>
                {t('home.editProfile.skillsSection')}
              </Text>
              <Pressable
                onPress={() => setShowAddSkill(true)}
                hitSlop={6}
              >
                <Ionicons name="add-circle" size={26} color={scheme.primary} />
              </Pressable>
            </View>

            {/* Skills List */}
            {profile.skills.map((skill) => (
              <View
                key={skill.id}
                style={[
                  styles.skillRow,
                  { backgroundColor: scheme.backgroundElement },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.skillName, { color: scheme.text }]}>
                    {skill.name}
                  </Text>
                  {skill.years_of_experience && (
                    <Text style={[styles.skillMeta, { color: scheme.textSecondary }]}>
                      {skill.years_of_experience} سنوات خبرة
                    </Text>
                  )}
                </View>
                <Pressable onPress={() => handleRemoveSkill(skill.id)} hitSlop={6}>
                  <Ionicons name="trash-outline" size={20} color={scheme.danger} />
                </Pressable>
              </View>
            ))}

            {/* Add Skill Form */}
            {showAddSkill && (
              <View style={styles.addSkillForm}>
                <AppTextInput
                  placeholder="اسم المهارة الجديدة"
                  value={newSkillName}
                  onChangeText={setNewSkillName}
                />
                <View style={styles.addSkillActions}>
                  <AppButton
                    title="إضافة"
                    variant="primary"
                    size="sm"
                    onPress={handleAddSkill}
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
                    }}
                    fullWidth={false}
                    style={{ flex: 1, marginStart: Spacing.two }}
                  />
                </View>
              </View>
            )}
          </AppCard>

          {/* Bio */}
          <AppCard padding="four" elevation="sm" style={styles.card}>
            <Text style={[styles.sectionTitle, { color: scheme.text }]}>
              {t('home.becomeProvider.bioLabel')}
            </Text>
            <AppTextInput
              placeholder={t('home.becomeProvider.bioPlaceholder')}
              value={profile.bio ?? ''}
              onChangeText={(v) => updateProviderProfile({ bio: v })}
              multiline
              numberOfLines={3}
              style={{ minHeight: 80, textAlignVertical: 'top' }}
            />
          </AppCard>
        </ScrollView>

        {/* Save */}
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
      </KeyboardAvoidingView>
    </SafeAreaView>
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
    marginBottom: Spacing.two,
    gap: Spacing.three,
  },
  skillName: {
    fontSize: FontSizes.base,
    fontWeight: FontWeights.medium,
    writingDirection: 'rtl',
  },
  skillMeta: {
    fontSize: FontSizes.xs,
    writingDirection: 'rtl',
    marginTop: 2,
  },
  addSkillForm: {
    marginTop: Spacing.two,
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