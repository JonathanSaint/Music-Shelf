import LegalDocumentScreen from '../../components/LegalDocumentScreen';
import { PRIVACY_SECTIONS } from '../../constants/legal';

export default function PrivacyScreen() {
  return <LegalDocumentScreen title="Privacy Policy" sections={PRIVACY_SECTIONS} />;
}
