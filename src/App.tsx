import { lazy, Suspense, useEffect } from 'react';
import { FeatureGate } from './lib/features';
import { featureMode } from '../shared/features';
import { setProgressContext } from './lib/progress';
import { setLiveWorld } from './lib/liveWorld';
import { PixieSprites, PixelateFilter } from './ui/PixieSprites';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { StoreProvider, useStore } from './lib/store';
import { Loading, Toasts } from './ui/kit';
import { PreviewBanner } from './ui/Nav';
import { SeasonLayer } from './world/Season';
import { PlacesPage, WorldPage } from './world/WorldPage';
import { RoomPage } from './rooms/RoomPage';
import { LoginPage, NotFound, SearchPage, SharePage } from './pages';
import { SetupPage } from './SetupPage';
import { IS_FIREBASE } from './lib/backend/config';

// Private areas load separately, so visitors never download the editor or dashboard code.
const DollhousePage = lazy(() => import('./private/Dollhouse').then((m) => ({ default: m.DollhousePage })));
const LetterboxPage = lazy(() => import('./private/Letterbox').then((m) => ({ default: m.LetterboxPage })));
const CabinetPage = lazy(() => import('./private/Cabinet').then((m) => ({ default: m.CabinetPage })));
const ConservatoryPage = lazy(() => import('./private/Conservatory').then((m) => ({ default: m.ConservatoryPage })));
const ReadingRoomPage = lazy(() => import('./private/ReadingDiary').then((m) => ({ default: m.ReadingRoomPage })));
const DiaryPage = lazy(() => import('./private/ReadingDiary').then((m) => ({ default: m.DiaryPage })));
const StargirlPage = lazy(() => import('./private/Stargirl').then((m) => ({ default: m.StargirlPage })));
const RabbitHolesPage = lazy(() => import('./private/Stargirl').then((m) => ({ default: m.RabbitHolesPage })));
const DiscoveriesPage = lazy(() => import('./private/Stargirl').then((m) => ({ default: m.DiscoveriesPage })));
const PicksPage = lazy(() => import('./private/Stargirl').then((m) => ({ default: m.PicksPage })));
const WorldEditorPage = lazy(() => import('./atelier/Atelier').then((m) => ({ default: m.WorldEditorPage })));
const RoomEditorPage = lazy(() => import('./atelier/Atelier').then((m) => ({ default: m.RoomEditorPage })));
const ThemeClosetPage = lazy(() => import('./atelier/Studio').then((m) => ({ default: m.ThemeClosetPage })));
const RoomsManagerPage = lazy(() => import('./atelier/Studio').then((m) => ({ default: m.RoomsManagerPage })));
const MediaLibraryPage = lazy(() => import('./atelier/Studio').then((m) => ({ default: m.MediaLibraryPage })));
const VillageSettingsPage = lazy(() => import('./atelier/Studio').then((m) => ({ default: m.VillageSettingsPage })));
const FeatureManagerPage = lazy(() => import('./atelier/FeatureManager').then((m) => ({ default: m.FeatureManagerPage })));
const BedroomPage = lazy(() => import('./private/Bedroom').then((m) => ({ default: m.BedroomPage })));
const PetsPage = lazy(() => import('./private/Pets').then((m) => ({ default: m.PetsPage })));
const CompanionLayer = lazy(() => import('./private/Pets').then((m) => ({ default: m.CompanionLayer })));
const NewspaperPage = lazy(() => import('./private/Newspaper').then((m) => ({ default: m.NewspaperPage })));
const ParlourPage = lazy(() => import('./private/Parlour').then((m) => ({ default: m.ParlourPage })));
const ReadingJournalPage = lazy(() => import('./private/ReadingJournal').then((m) => ({ default: m.ReadingJournalPage })));
const CommonplacePage = lazy(() => import('./private/CommonplacePage').then((m) => ({ default: m.CommonplacePage })));
const BackupsPage = lazy(() => import('./atelier/Studio').then((m) => ({ default: m.BackupsPage })));

/** The following companion only loads for the owner when the Pets feature is on. */
function OwnerCompanion() {
  const { owner, world } = useStore();
  if (!owner || featureMode(world, 'pets') !== 'on') return null;
  return <Suspense fallback={null}><CompanionLayer /></Suspense>;
}

/** Connects the optional progress system to who is looking and which features are on; Alt+Q toggles Quiet. */
function ProgressBridge() {
  const { owner, world, toast, appearance, setAppearance } = useStore();
  const achievementsOn = featureMode(world, 'achievements') !== 'off' && appearance !== 'quiet';
  const pearlsOn = featureMode(world, 'pearls') !== 'off';
  setLiveWorld(world);
  useEffect(() => { setProgressContext({ owner, achievementsOn, pearlsOn, celebrate: (m) => toast(`✨ ${m}`, { essential: false }) }); }, [owner, achievementsOn, pearlsOn, toast]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.altKey && (e.key === 'q' || e.key === 'Q' || e.code === 'KeyQ')) { e.preventDefault(); setAppearance(appearance === 'quiet' ? null : 'quiet'); } };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [appearance, setAppearance]);
  return null;
}

function Shell() {
  const { ready, offline } = useStore();
  if (!ready) return <div className="boot"><Loading what="Opening the gate" /></div>;
  if (offline && !(IS_FIREBASE && location.pathname === '/setup')) {
    if (IS_FIREBASE) {
      return (
        <div className="boot">
          <div className="paper-sheet center" style={{ maxWidth: 560 }}>
            <p className="script big">The village can't reach the cloud</p>
            <p>The page loaded, but Ribbonmere couldn't connect to Firebase. If you're setting the site up, the checklist shows what's missing. Otherwise, check your internet connection.</p>
            <a className="btn" href="/setup">Open the setup checklist</a> <button className="btn ghost" onClick={() => location.reload()}>Try again</button>
          </div>
        </div>
      );
    }
    return (
      <div className="boot">
        <div className="paper-sheet center" style={{ maxWidth: 560 }}>
          <p className="script big">The village server is asleep</p>
          <p>This page loaded, but the part of Ribbonmere that stores your world isn't answering.</p>
          <p className="muted">If you're running it yourself, start it with <code>npm run dev</code> (or <code>npm start</code> after <code>npm run build</code>) and keep that window open, then reload this page.</p>
          <button className="btn" onClick={() => location.reload()}>Try again</button>
        </div>
      </div>
    );
  }
  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <PreviewBanner />
      <SeasonLayer />
      <ProgressBridge />
      <PixieSprites />
      <PixelateFilter />
      <OwnerCompanion />
      <Suspense fallback={<Loading />}>
        <FeatureGate>
        <Routes>
          <Route path="/" element={<WorldPage />} />
          <Route path="/places" element={<PlacesPage />} />
          <Route path="/room/:roomId" element={<RoomPage />} />
          <Route path="/room/:roomId/:itemId" element={<RoomPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/share" element={<SharePage />} />
          <Route path="/setup" element={<SetupPage />} />
          <Route path="/dollhouse" element={<DollhousePage />} />
          <Route path="/dollhouse/inbox" element={<LetterboxPage />} />
          <Route path="/dollhouse/reading" element={<ReadingRoomPage />} />
          <Route path="/dollhouse/diary" element={<DiaryPage />} />
          <Route path="/dollhouse/bookmarks" element={<CabinetPage />} />
          <Route path="/dollhouse/favorites" element={<ConservatoryPage />} />
          <Route path="/dollhouse/bedroom" element={<BedroomPage />} />
          <Route path="/dollhouse/pets" element={<PetsPage />} />
          <Route path="/dollhouse/newspaper" element={<NewspaperPage />} />
          <Route path="/dollhouse/parlour" element={<ParlourPage />} />
          <Route path="/dollhouse/reading-journal" element={<ReadingJournalPage />} />
          <Route path="/dollhouse/commonplace" element={<CommonplacePage />} />
          <Route path="/stargirl" element={<StargirlPage />} />
          <Route path="/stargirl/rabbit-holes" element={<RabbitHolesPage />} />
          <Route path="/stargirl/discoveries" element={<DiscoveriesPage />} />
          <Route path="/stargirl/picks" element={<PicksPage />} />
          <Route path="/atelier" element={<WorldEditorPage />} />
          <Route path="/atelier/room/:roomId" element={<RoomEditorPage />} />
          <Route path="/atelier/theme" element={<ThemeClosetPage />} />
          <Route path="/atelier/rooms" element={<RoomsManagerPage />} />
          <Route path="/atelier/media" element={<MediaLibraryPage />} />
          <Route path="/atelier/village" element={<VillageSettingsPage />} />
          <Route path="/atelier/backup" element={<BackupsPage />} />
          <Route path="/atelier/features" element={<FeatureManagerPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        </FeatureGate>
      </Suspense>
      <Toasts />
    </>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <BrowserRouter>
        <Shell />
      </BrowserRouter>
    </StoreProvider>
  );
}
