import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Entete } from "./components/Entete";
import { BottomNavMobile } from "./components/BottomNavMobile";
import { IndicateurChargement } from "./components/IndicateurChargement";
import { GarageLayout } from "./components/GarageLayout";
import { RouteProtegee } from "./components/RouteProtegee";
import { useAuth } from "./context/AuthContext";
import { kycBloqueActivite } from "./lib/kyc";
import { estAppNative } from "./lib/native";
import { onboardingDejaVu } from "./lib/onboarding";
import { EntreeRacine } from "./pages/EntreeRacine";
import { Connexion } from "./pages/Connexion";
import { Inscription } from "./pages/Inscription";
import { MotDePasseOublie } from "./pages/MotDePasseOublie";
import { Vehicules } from "./pages/Vehicules";
import { CatalogueMobile } from "./pages/CatalogueMobile";
import { useEstMobile } from "./lib/estMobile";
import { VehiculeDetail } from "./pages/VehiculeDetail";
import { Paiement } from "./pages/Paiement";
import { MesReservations } from "./pages/MesReservations";
import { CompleterDossier } from "./pages/CompleterDossier";
import { MesInformations } from "./pages/MesInformations";
import { Notifications } from "./pages/Notifications";
import { AideSupport } from "./pages/AideSupport";
import { ChangerMotDePasse } from "./pages/ChangerMotDePasse";
import { TableauDeBordGarage } from "./pages/garage/TableauDeBord";
import { UtilisateursGarage } from "./pages/garage/Utilisateurs";
import { VehiculesGarage } from "./pages/garage/Vehicules";
import { NouveauVehiculeGarage } from "./pages/garage/NouveauVehicule";
import { ModifierVehiculeGarage } from "./pages/garage/ModifierVehicule";
import { ReservationsGarage } from "./pages/garage/Reservations";
import { ReservationDetailGarage } from "./pages/garage/ReservationDetail";
import { EquipeGarage } from "./pages/garage/Equipe";
import { JournalLocationsGarage } from "./pages/garage/JournalLocations";
import { PerformanceGarage } from "./pages/garage/PerformanceGarage";
import { AgencesGarage } from "./pages/garage/Agences";
import { TableauDeBordAgence } from "./pages/agence/TableauDeBord";
import { ModifierVehiculeAgence, NouveauVehiculeAgence, VehiculesAgence } from "./pages/agence/Vehicules";
import { ReservationsAgence } from "./pages/agence/Reservations";
import { RevenusAgence } from "./pages/agence/Revenus";
import { ProfilAgence } from "./pages/agence/Profil";

const ROUTES_SANS_KYC = new Set([
  "/",
  "/connexion",
  "/inscription",
  "/mot-de-passe-oublie",
  "/changer-mot-de-passe",
  "/mon-dossier",
  "/vehicules",
  "/mes-informations",
  "/notifications",
  "/aide-support",
]);

function routeAutoriseeSansKyc(pathname: string) {
  if (ROUTES_SANS_KYC.has(pathname)) return true;
  if (pathname.startsWith("/vehicules/")) return true;
  return false;
}

function App() {
  const { utilisateur, chargementSession } = useAuth();
  const location = useLocation();
  const mobile = useEstMobile();

  if (chargementSession) {
    return <IndicateurChargement />;
  }

  const estAccueil = location.pathname === "/";
  const estCatalogue =
    location.pathname === "/vehicules" || location.pathname.startsWith("/vehicules/");
  const estVehiculeDetail = location.pathname.startsWith("/vehicules/");
  const estSansMenuGlobal =
    estVehiculeDetail ||
    location.pathname === "/mes-reservations" ||
    location.pathname === "/mon-dossier";
  const estAuth =
    location.pathname === "/connexion" ||
    location.pathname === "/inscription" ||
    location.pathname === "/mot-de-passe-oublie" ||
    location.pathname === "/changer-mot-de-passe";

  const estEspace =
    location.pathname === "/mes-reservations" ||
    location.pathname === "/mon-dossier" ||
    location.pathname === "/mes-informations" ||
    location.pathname === "/notifications" ||
    location.pathname === "/aide-support" ||
    location.pathname.startsWith("/garage/") ||
    location.pathname.startsWith("/agence/");
  // Back-offices (administration et agences partenaires) : même habillage.
  const estGarage = location.pathname.startsWith("/garage/") || location.pathname.startsWith("/agence/");
  const estPaiement = location.pathname.startsWith("/paiement/");

  const estOnboardingMobile =
    estAppNative() && location.pathname === "/" && !onboardingDejaVu();

  const natif = estAppNative();
  const estCatalogueMobile = mobile && location.pathname === "/vehicules";
  // Pages « Mes réservations », « Mon dossier » et « Mes informations » : nouveau format (fond blanc).
  const estRefonte =
    location.pathname === "/mes-reservations" ||
    location.pathname === "/mon-dossier" ||
    location.pathname === "/mes-informations" ||
    location.pathname === "/aide-support" ||
    location.pathname === "/notifications";
  // Mobile : la racine est l'écran de bienvenue plein écran (pas de landing, ni en-tête, ni barre basse).
  const estBienvenueMobile = mobile && estAccueil && !utilisateur && !estOnboardingMobile;
  const estEcranSansNav =
    estOnboardingMobile || estBienvenueMobile || estAuth || estGarage || estPaiement;
  const afficheNavBasse = (natif || estCatalogueMobile || (mobile && estRefonte)) && !estEcranSansNav;
  const afficheEntete =
    !estEcranSansNav && !estSansMenuGlobal && !natif && !estCatalogueMobile && !(mobile && estRefonte);
  const doitChangerMotDePasse =
    utilisateur?.doitChangerMotDePasse && location.pathname !== "/changer-mot-de-passe";

  const doitCompleterKyc =
    !doitChangerMotDePasse && kycBloqueActivite(utilisateur) && !routeAutoriseeSansKyc(location.pathname);

  const classeContenu = [
    "app-contenu",
    estAccueil && !estOnboardingMobile ? "app-contenu--landing" : "",
    estOnboardingMobile ? "app-contenu--onboarding" : "",
    estCatalogue ? "app-contenu--vehicules" : "",
    estCatalogueMobile ? "app-contenu--catalogue-mobile" : "",
    estRefonte ? "app-contenu--refonte" : "",
    mobile && estVehiculeDetail ? "app-contenu--detail-mobile" : "",
    estAuth ? "app-contenu--auth" : "",
    estEspace ? "app-contenu--espace" : "",
    estGarage ? "app-contenu--garage" : "",
    estPaiement ? "app-contenu--paiement" : "",
    afficheNavBasse ? "app-contenu--nav-basse" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={`app${estAccueil && !estOnboardingMobile ? " app--landing" : ""}${estOnboardingMobile ? " app--onboarding" : ""}${estAuth ? " app--auth" : ""}${estEspace ? " app--espace" : ""}${location.pathname === "/vehicules" ? " app--catalogue-hero" : ""}${estGarage ? " app--garage" : ""}${estPaiement ? " app--paiement" : ""}`}
    >
      {afficheEntete && <Entete />}
      <main className={classeContenu}>
        {doitChangerMotDePasse ? (
          <Navigate to="/changer-mot-de-passe" replace />
        ) : doitCompleterKyc ? (
          <Navigate to="/mon-dossier" replace state={{ depuisBlocage: true }} />
        ) : (
          <Routes>
            <Route path="/" element={<EntreeRacine />} />
            <Route path="/a-propos" element={<Navigate to="/" replace />} />
            <Route path="/connexion" element={<Connexion />} />
            <Route path="/inscription" element={<Inscription />} />
            <Route path="/mot-de-passe-oublie" element={<MotDePasseOublie />} />
            <Route path="/vehicules" element={mobile ? <CatalogueMobile /> : <Vehicules />} />
            <Route path="/vehicules/:code" element={<VehiculeDetail />} />
            <Route
              path="/paiement/:code"
              element={
                <RouteProtegee role="LOCATAIRE">
                  <Paiement />
                </RouteProtegee>
              }
            />
            <Route
              path="/mes-reservations"
              element={
                <RouteProtegee role="LOCATAIRE">
                  <MesReservations />
                </RouteProtegee>
              }
            />
            <Route
              path="/changer-mot-de-passe"
              element={
                <RouteProtegee>
                  <ChangerMotDePasse />
                </RouteProtegee>
              }
            />
            <Route
              path="/mon-dossier"
              element={
                <RouteProtegee role="LOCATAIRE">
                  <CompleterDossier />
                </RouteProtegee>
              }
            />
            <Route
              path="/mes-informations"
              element={
                <RouteProtegee role="LOCATAIRE">
                  <MesInformations />
                </RouteProtegee>
              }
            />
            <Route path="/notifications" element={<Notifications />} />
            <Route
              path="/aide-support"
              element={
                <RouteProtegee role="LOCATAIRE">
                  <AideSupport />
                </RouteProtegee>
              }
            />
            <Route
              path="/garage"
              element={
                <RouteProtegee role="GARAGE">
                  <GarageLayout />
                </RouteProtegee>
              }
            >
              <Route path="tableau-de-bord" element={<TableauDeBordGarage />} />
              <Route path="utilisateurs" element={<UtilisateursGarage />} />
              <Route path="vehicules" element={<VehiculesGarage />} />
              <Route path="vehicules/nouveau" element={<NouveauVehiculeGarage />} />
              <Route path="vehicules/:code/modifier" element={<ModifierVehiculeGarage />} />
              <Route path="reservations" element={<ReservationsGarage />} />
              <Route path="reservations/:code" element={<ReservationDetailGarage />} />
              <Route path="journal" element={<JournalLocationsGarage />} />
              <Route path="performance" element={<PerformanceGarage />} />
              <Route path="equipe" element={<EquipeGarage />} />
              <Route path="agences" element={<AgencesGarage />} />
            </Route>
            <Route
              path="/agence"
              element={
                <RouteProtegee role="AGENCE">
                  <GarageLayout espace="agence" />
                </RouteProtegee>
              }
            >
              <Route index element={<Navigate to="tableau-de-bord" replace />} />
              <Route path="tableau-de-bord" element={<TableauDeBordAgence />} />
              <Route path="vehicules" element={<VehiculesAgence />} />
              <Route path="vehicules/nouveau" element={<NouveauVehiculeAgence />} />
              <Route path="vehicules/:code/modifier" element={<ModifierVehiculeAgence />} />
              <Route path="reservations" element={<ReservationsAgence />} />
              <Route path="revenus" element={<RevenusAgence />} />
              <Route path="profil" element={<ProfilAgence />} />
            </Route>
            <Route path="/proprietaire/*" element={<Navigate to="/" replace />} />
            <Route path="/chauffeur/*" element={<Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        )}
      </main>
      {afficheNavBasse && <BottomNavMobile />}
    </div>
  );
}

export default App;
