import { useNavigation } from "expo-router";
import { StackActions } from "@react-navigation/native";
import { useEffect } from "react";

/** The unqualified /profile path also matches this legacy route. Address the
 * root stack explicitly so old links cannot redirect back into themselves. */
export default function ProfileRedirect() {
  const root = useNavigation("/");
  useEffect(() => {
    root.dispatch(StackActions.replace("profile"));
  }, [root]);
  return null;
}
