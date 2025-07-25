import { Toaster } from 'react-hot-toast';

export default function toast({ Component, pageProps }) {
  return (
    <>
      <Toaster position="top-right" />
      <Component {...pageProps} />
    </>
  );
}
