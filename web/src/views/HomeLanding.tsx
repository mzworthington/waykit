import { HomeHero } from '../components/HomeHero';
import { HomeNext } from '../components/HomeNext';
import { HomeUsedIn } from '../components/HomeUsedIn';

export function HomeLanding() {
  return (
    <div className="landing-page">
      <HomeHero />
      <HomeNext />
      <HomeUsedIn />
    </div>
  );
}
