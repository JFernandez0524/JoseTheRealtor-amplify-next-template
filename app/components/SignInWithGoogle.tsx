interface SignInWithGoogleButtonProps {
  text: string;
}

export default function SignInWithGoogleButton({
  text,
}: SignInWithGoogleButtonProps) {
  return <a href='/api/auth/sign-in?provider=Google'>{text}</a>;
}
