import { Redirect } from "expo-router";
/** Preserve old deep links; discovery now lives on Home. */
export default function ExploreRedirect() {
  return <Redirect href="/(tabs)" />;
}
