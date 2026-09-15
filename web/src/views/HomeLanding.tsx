import { HomeHero } from '../components/HomeHero';
import { HomeNext } from '../components/HomeNext';

export function HomeLanding() {
  return (
    <div className="landing-page">
      <HomeHero />
      <HomeNext />
    </div>
  );
}
