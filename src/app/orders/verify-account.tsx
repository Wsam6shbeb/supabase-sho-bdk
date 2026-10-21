import { ScreenSafeArea } from '@/components/ui/ScreenSafeArea';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { Colors, FontSizes, FontWeights, Radii, Spacing } from '@/constants/theme';
import { useMyVerification } from '@/hooks/use-my-verification';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/ar';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

interface Photo { uri: string; base64: string }

export default function VerifyAccountScreen() {
  const scheme = Colors[useTheme()];
  const { status, submittedAt, rejectionReason, loading, submit } = useMyVerification();
  const [idPhoto, setIdPhoto] = useState<Photo | null>(null);
  const [selfie, setSelfie] = useState<Photo | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const pickImage = async (target: 'id' | 'selfie') => {
    try {
      const { status: permission } = await ImagePicker.requestCameraPermissionsAsync();
      if (permission !== 'granted') {
        Alert.alert('صلاحية الكاميرا', 'يرجى السماح باستخدام الكاميرا من إعدادات الهاتف ثم المحاولة مجدداً.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        cameraType: target === 'selfie' ? ImagePicker.CameraType.front : ImagePicker.CameraType.back,
        allowsEditing: true,
        aspect: target === 'selfie' ? [1, 1] : [4, 3],
        quality: 0.5,
        base64: true,
      });
      const asset = result.canceled ? null : result.assets[0];
      if (asset?.base64) {
        const photo = { uri: asset.uri, base64: asset.base64 };
        target === 'id' ? setIdPhoto(photo) : setSelfie(photo);
      }
    } catch {
      Alert.alert('خطأ', 'تعذّر فتح الكاميرا');
    }
  };

  const handleSubmit = async () => {
    if (!idPhoto || !selfie) {
      Alert.alert('مطلوب', t('verification.requiredPhotos'));
      return;
    }
    setSubmitting(true);
    try {
      const result = await submit(idPhoto.base64, selfie.base64);
      if (!result.ok) {
        Alert.alert('تعذّر الإرسال', result.message ?? 'حاول مجدداً.');
        return;
      }
      setIdPhoto(null);
      setSelfie(null);
      setRetrying(false);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <ScreenSafeArea style={[styles.safe, { backgroundColor: scheme.background }]}><View style={styles.center}><ActivityIndicator size="large" color={scheme.primary} /></View></ScreenSafeArea>;

  if (status === 'verified' || status === 'under_review' || (status === 'rejected' && !retrying)) {
    const verified = status === 'verified';
    const pending = status === 'under_review';
    const color = verified ? scheme.success : pending ? scheme.warning : scheme.danger;
    const icon = verified ? 'checkmark-circle' : pending ? 'time' : 'close-circle';
    const title = verified ? t('verification.verifiedTitle') : pending ? t('verification.underReviewTitle') : t('verification.rejectedTitle');
    const subtitle = verified ? t('verification.verifiedSubtitle') : pending ? t('verification.underReviewSubtitle') : (rejectionReason ?? t('verification.rejectedSubtitle'));
    return <ScreenSafeArea style={[styles.safe, { backgroundColor: scheme.background }]}><View style={styles.center}>
      <Ionicons name={icon} size={76} color={color} />
      <Text style={[styles.centerTitle, { color: scheme.text }]}>{title}</Text>
      <Text style={[styles.subtitle, { color: scheme.textSecondary }]}>{subtitle}</Text>
      {pending && submittedAt ? <Text style={{ color: scheme.textTertiary, marginTop: 12 }}>{t('verification.submittedAt')}: {new Date(submittedAt).toLocaleString('ar-SY')}</Text> : null}
      {status === 'rejected' ? <AppButton title={t('verification.retryBtn')} variant="primary" size="lg" onPress={() => setRetrying(true)} style={{ marginTop: 24, width: '100%' }} /> : <AppButton title={t('common.back')} variant="secondary" size="lg" onPress={() => router.back()} style={{ marginTop: 24, width: '100%' }} />}
    </View></ScreenSafeArea>;
  }

  return <ScreenSafeArea style={[styles.safe, { backgroundColor: scheme.background }]}><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    <View style={styles.header}><Pressable onPress={() => router.back()} hitSlop={8}><Ionicons name="arrow-forward" size={26} color={scheme.primary} /></Pressable><Text style={[styles.headerTitle, { color: scheme.text }]}>{t('verification.title')}</Text><View style={{ width: 26 }} /></View>
    <View style={styles.centerIntro}><Ionicons name="shield-checkmark" size={48} color={scheme.primary} /><Text style={[styles.centerTitle, { color: scheme.text }]}>{t('verification.notVerifiedTitle')}</Text><Text style={[styles.subtitle, { color: scheme.textSecondary }]}>{t('verification.notVerifiedSubtitle')}</Text></View>
    <AppCard padding="four" elevation="sm" style={styles.card}><Text style={[styles.sectionTitle, { color: scheme.text }]}>{t('verification.benefitsTitle')}</Text>{[1,2,3].map(i => <View key={i} style={styles.benefit}><Ionicons name="checkmark-circle" size={20} color={scheme.success}/><Text style={{ color: scheme.textSecondary, flex: 1 }}>{t(`verification.benefit${i}`)}</Text></View>)}</AppCard>
    {([{key:'id',photo:idPhoto,set:setIdPhoto,title:t('verification.step1Title'),subtitle:t('verification.step1Subtitle')},{key:'selfie',photo:selfie,set:setSelfie,title:t('verification.step2Title'),subtitle:t('verification.step2Subtitle')}] as const).map(item => <AppCard key={item.key} padding="four" elevation="sm" style={styles.card}>
      <Text style={[styles.sectionTitle, { color: scheme.text }]}>{item.title}</Text><Text style={[styles.hint, { color: scheme.textSecondary }]}>{item.subtitle}</Text>
      <Pressable onPress={() => pickImage(item.key)} style={[styles.upload, { backgroundColor: scheme.backgroundElement, borderColor: item.photo ? scheme.success : scheme.border }]}>{item.photo ? <><Image source={{ uri: item.photo.uri }} style={styles.preview}/><View style={[styles.change,{backgroundColor:scheme.primary}]}><Text style={{color:scheme.primaryContrast}}>{t('verification.changeBtn')}</Text></View></> : <><Ionicons name={item.key==='id'?'camera-outline':'person-circle-outline'} size={36} color={scheme.textSecondary}/><Text style={{color:scheme.textSecondary}}>{t('verification.uploadBtn')}</Text></>}</Pressable>
    </AppCard>)}
    <Text style={[styles.privacy, { color: scheme.textTertiary }]}>صورتاك لا يراهما أي مستخدم آخر. يراجعهما مسؤول مخوّل فقط، ونحتفظ بهما لأغراض السلامة، وقد تُسلَّمان للجهات المختصة بطلب رسمي.</Text>
    <AppButton title={submitting ? t('verification.submittingBtn') : t('verification.submitBtn')} variant="primary" size="lg" onPress={handleSubmit} loading={submitting} disabled={submitting || !idPhoto || !selfie} style={{marginTop:Spacing.four}} />
  </ScrollView></ScreenSafeArea>;
}

const styles = StyleSheet.create({
  safe:{flex:1}, content:{paddingHorizontal:Spacing.four,paddingBottom:Spacing.eight},
  header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingVertical:Spacing.three},
  headerTitle:{fontSize:FontSizes.lg,fontWeight:FontWeights.bold,writingDirection:'rtl'},
  center:{flex:1,alignItems:'center',justifyContent:'center',paddingHorizontal:Spacing.six},
  centerIntro:{alignItems:'center',marginVertical:Spacing.five},
  centerTitle:{fontSize:FontSizes['2xl'],fontWeight:FontWeights.bold,textAlign:'center',writingDirection:'rtl',marginVertical:Spacing.two},
  subtitle:{fontSize:FontSizes.base,textAlign:'center',writingDirection:'rtl',lineHeight:FontSizes.lg+4},
  card:{marginBottom:Spacing.three}, sectionTitle:{fontSize:FontSizes.base,fontWeight:FontWeights.semibold,writingDirection:'rtl',marginBottom:Spacing.two},
  benefit:{flexDirection:'row',alignItems:'center',gap:Spacing.two,marginTop:Spacing.two},
  hint:{fontSize:FontSizes.sm,writingDirection:'rtl',marginBottom:Spacing.three,lineHeight:FontSizes.base+4},
  upload:{height:160,borderRadius:Radii.lg,borderWidth:2,borderStyle:'dashed',alignItems:'center',justifyContent:'center',overflow:'hidden',gap:Spacing.two},
  preview:{width:'100%',height:'100%',resizeMode:'cover'}, change:{position:'absolute',bottom:Spacing.two,right:Spacing.two,paddingHorizontal:Spacing.three,paddingVertical:Spacing.one,borderRadius:Radii.md},
  privacy:{fontSize:FontSizes.xs,writingDirection:'rtl',textAlign:'center',lineHeight:FontSizes.sm+4,marginTop:Spacing.two,paddingHorizontal:Spacing.two}
});
