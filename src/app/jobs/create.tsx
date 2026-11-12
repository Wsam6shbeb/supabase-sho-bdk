// ===============================================================
// إضافة وظيفة أو تعديلها (عند تمرير job_id). وسيلة التواصل حقل إلزامي.
// الخادم يفحص الألفاظ ويطبّق الحد الأقصى للوظائف الفعّالة، ونعرض رسالته للمستخدم.
// ===============================================================

import { ChoiceChips } from '@/components/jobs/ChoiceChips';
import { AppButton } from '@/components/ui/AppButton';
import { AppTextInput } from '@/components/ui/AppTextInput';
import { ErrorState } from '@/components/ui/ErrorState';
import { GuardedPressable } from '@/components/ui/GuardedPressable';
import { LoadingState } from '@/components/ui/LoadingState';
import {
  CONTACT_PLACEHOLDERS,
  CONTACT_TYPE_OPTIONS,
  JOB_LIMITS,
  JOB_TYPE_OPTIONS,
} from '@/config/jobs';
import { KEYBOARD_AVOIDING_BEHAVIOR } from '@/constants/keyboard';
import { Colors, FontSizes, FontWeights, Radii, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { usePreferredCity } from '@/hooks/use-preferred-city';
import { useTheme } from '@/hooks/use-theme';
import { getUserMessage } from '@/services/errors';
import {
  createJob,
  getJob,
  getJobContact,
  jobErrorMessage,
  markJobsDirty,
  updateJob,
} from '@/services/jobPosts';
import type { ContactType, JobInput, JobType } from '@/types/jobs';
import {
  mergeSkills,
  normalizeContactValue,
  validateContact,
} from '@/utils/jobs';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type FieldErrors = Partial<Record<'title' | 'description' | 'region' | 'contact', string>>;

export default function CreateJobScreen() {
  const theme = useTheme();
  const scheme = Colors[theme];
  const { user } = useAuth();
  const params = useLocalSearchParams<{ job_id?: string | string[] }>();
  const editingId = Array.isArray(params.job_id) ? params.job_id[0] : params.job_id;
  const isEditing = Boolean(editingId);

  const { city, setCity, remember } = usePreferredCity();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [area, setArea] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [skillText, setSkillText] = useState('');
  const [jobType, setJobType] = useState<JobType>('full_time');
  const [salary, setSalary] = useState('');
  const [contactType, setContactType] = useState<ContactType>('phone');
  const [contact, setContact] = useState('');

  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loadingJob, setLoadingJob] = useState(isEditing);
  const [loadError, setLoadError] = useState<string | null>(null);

  // وضع التعديل: نملأ الحقول من الوظيفة الحالية (ووسيلة التواصل من الدالة الآمنة).
  const loadExisting = useCallback(async () => {
    if (!editingId) return;
    setLoadingJob(true);
    setLoadError(null);
    try {
      const [job, existingContact] = await Promise.all([getJob(editingId), getJobContact(editingId)]);
      if (!job || job.user_id !== user?.id) {
        setLoadError('لا يمكنك تعديل هذه الوظيفة.');
        return;
      }
      setTitle(job.title);
      setDescription(job.description);
      setCity(job.region);
      setArea(job.area ?? '');
      setSkills(job.skills);
      setJobType(job.job_type);
      setSalary(job.salary_text ?? '');
      setContactType(existingContact?.contact_type ?? job.contact_type);
      setContact(existingContact?.contact_value ?? '');
    } catch (err) {
      setLoadError(getUserMessage(err, 'load'));
    } finally {
      setLoadingJob(false);
    }
  }, [editingId, user?.id, setCity]);

  useEffect(() => {
    void loadExisting();
  }, [loadExisting]);

  const addSkills = useCallback((raw: string) => {
    setSkills((prev) => mergeSkills(prev, raw));
    setSkillText('');
  }, []);

  const handleSkillChange = (value: string) => {
    if (/[,،؛;\n]/.test(value)) addSkills(value);
    else setSkillText(value);
  };

  const removeSkill = (skill: string) => setSkills((prev) => prev.filter((s) => s !== skill));

  const handleSubmit = async () => {
    if (submitting || !user) return;

    const cleanTitle = title.trim();
    const cleanDescription = description.trim();
    const cleanRegion = city.trim();
    const cleanContact = normalizeContactValue(contactType, contact);
    const finalSkills = mergeSkills(skills, skillText);

    const nextErrors: FieldErrors = {};
    if (cleanTitle.length < JOB_LIMITS.titleMin || cleanTitle.length > JOB_LIMITS.titleMax) {
      nextErrors.title = `العنوان من ${JOB_LIMITS.titleMin} إلى ${JOB_LIMITS.titleMax} حرفاً.`;
    }
    if (
      cleanDescription.length < JOB_LIMITS.descriptionMin ||
      cleanDescription.length > JOB_LIMITS.descriptionMax
    ) {
      nextErrors.description = `الوصف من ${JOB_LIMITS.descriptionMin} إلى ${JOB_LIMITS.descriptionMax} حرف.`;
    }
    if (cleanRegion.length < JOB_LIMITS.regionMin || cleanRegion.length > JOB_LIMITS.regionMax) {
      nextErrors.region = 'أدخل اسم المدينة.';
    }
    const contactProblem = validateContact(contactType, cleanContact);
    if (contactProblem) nextErrors.contact = contactProblem;

    setErrors(nextErrors);
    setFormError(null);
    if (Object.keys(nextErrors).length > 0) return;

    const input: JobInput = {
      title: cleanTitle,
      description: cleanDescription,
      region: cleanRegion,
      area: area.trim() ? area.trim().slice(0, JOB_LIMITS.areaMax) : null,
      skills: finalSkills,
      job_type: jobType,
      salary_text: salary.trim() ? salary.trim().slice(0, JOB_LIMITS.salaryMax) : null,
      contact_type: contactType,
      contact_value: cleanContact,
    };

    setSubmitting(true);
    try {
      if (editingId) await updateJob(editingId, input);
      else await createJob(user.id, input);
      remember(cleanRegion);
      markJobsDirty();
      router.replace('/jobs/mine' as Href);
    } catch (err) {
      setFormError(jobErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/' as Href));

  const header = (
    <View style={styles.header}>
      <GuardedPressable onPress={goBack} accessibilityRole="button" accessibilityLabel="إغلاق" hitSlop={12}>
        <Ionicons name="close" size={26} color={scheme.text} />
      </GuardedPressable>
      <Text style={[styles.headerTitle, { color: scheme.text }]}>
        {isEditing ? 'تعديل الوظيفة' : 'إضافة وظيفة'}
      </Text>
      <View style={styles.headerSpacer} />
    </View>
  );

  if (loadingJob) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: scheme.background }]}>
        {header}
        <LoadingState fullscreen={false} />
      </SafeAreaView>
    );
  }

  if (loadError) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: scheme.background }]}>
        {header}
        <ErrorState message={loadError} onRetry={loadExisting} fullscreen={false} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: scheme.background }]}>
      {header}
      <KeyboardAvoidingView style={styles.flex} behavior={KEYBOARD_AVOIDING_BEHAVIOR}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <AppTextInput
            label="عنوان الوظيفة"
            required
            value={title}
            onChangeText={setTitle}
            maxLength={JOB_LIMITS.titleMax}
            error={errors.title}
          />
          <AppTextInput
            label="وصف الوظيفة"
            required
            value={description}
            onChangeText={setDescription}
            multiline
            maxLength={JOB_LIMITS.descriptionMax}
            error={errors.description}
            style={styles.multiline}
          />

          <AppTextInput
            label="المدينة"
            required
            value={city}
            onChangeText={setCity}
            maxLength={JOB_LIMITS.regionMax}
            error={errors.region}
          />
          <AppTextInput
            label="المنطقة (اختياري)"
            value={area}
            onChangeText={setArea}
            maxLength={JOB_LIMITS.areaMax}
          />

          <ChoiceChips label="نوع الدوام" options={JOB_TYPE_OPTIONS} value={jobType} onChange={setJobType} />

          <AppTextInput
            label="الراتب (اختياري)"
            value={salary}
            onChangeText={setSalary}
            maxLength={JOB_LIMITS.salaryMax}
            placeholder="مثال: حسب الخبرة"
          />

          <AppTextInput
            label="الخبرات المطلوبة (اختياري)"
            value={skillText}
            onChangeText={handleSkillChange}
            onSubmitEditing={() => addSkills(skillText)}
            onBlur={() => addSkills(skillText)}
            returnKeyType="done"
            placeholder="اكتب خبرة ثم اضغط إدخال أو فاصلة"
          />
          {skills.length > 0 ? (
            <View style={styles.skillsRow}>
              {skills.map((skill) => (
                <GuardedPressable
                  key={skill}
                  onPress={() => removeSkill(skill)}
                  accessibilityRole="button"
                  accessibilityLabel={`حذف ${skill}`}
                  style={[styles.skillChip, { backgroundColor: scheme.tintPrimary }]}
                >
                  <Text style={[styles.skillText, { color: scheme.primary }]}>{skill}</Text>
                  <Ionicons name="close" size={14} color={scheme.primary} />
                </GuardedPressable>
              ))}
            </View>
          ) : null}

          <ChoiceChips
            label="وسيلة التواصل مع المتقدمين"
            options={CONTACT_TYPE_OPTIONS}
            value={contactType}
            onChange={(next) => {
              setContactType(next);
              setErrors((prev) => ({ ...prev, contact: undefined }));
            }}
          />
          <AppTextInput
            label="رقم أو عنوان التواصل"
            required
            value={contact}
            onChangeText={setContact}
            type={contactType === 'phone' || contactType === 'whatsapp' ? 'phone' : contactType === 'email' ? 'email' : 'text'}
            placeholder={CONTACT_PLACEHOLDERS[contactType]}
            error={errors.contact}
          />

          {formError ? (
            <Text style={[styles.formError, { color: scheme.danger }]}>{formError}</Text>
          ) : null}

          <AppButton
            title={isEditing ? 'حفظ التعديلات' : 'نشر الوظيفة'}
            loading={submitting}
            onPress={handleSubmit}
            style={styles.submit}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  headerTitle: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.semibold,
    writingDirection: 'rtl',
  },
  headerSpacer: { width: 26 },
  content: { padding: Spacing.four, paddingBottom: Spacing.eight },
  multiline: { minHeight: 110, textAlignVertical: 'top' },
  skillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginBottom: Spacing.four,
  },
  skillChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Radii.full,
  },
  skillText: { fontSize: FontSizes.sm, writingDirection: 'rtl' },
  formError: {
    fontSize: FontSizes.sm,
    textAlign: 'right',
    writingDirection: 'rtl',
    marginBottom: Spacing.three,
  },
  submit: { marginTop: Spacing.two },
});
