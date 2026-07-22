import ConsumerConnect from '../../../components/ConsumerConnect';

export const metadata = {
  title: 'Conectar con un profesional — Calorfy',
  robots: { index: false, follow: false },
};

export default async function ConnectPage({ params }) {
  const { token } = await params;
  return <ConsumerConnect token={token}/>;
}
