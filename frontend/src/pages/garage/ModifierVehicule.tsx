import { useParams } from "react-router-dom";
import { VehiculeFormGarage } from "./VehiculeForm";

export function ModifierVehiculeGarage() {
  const { code } = useParams<{ code: string }>();
  if (!code) return null;
  return <VehiculeFormGarage mode="edition" codePublic={code} />;
}
