import { HOME_NEXT, JOBS_FOR_TODAY } from '../landing/copy';

export function HomeNext() {
  return (
    <section className="home-next" aria-labelledby="next">
      <h2 id="next">Start in the docs</h2>
      <ul className="home-next-grid">
        {HOME_NEXT.map((item) => (
          <li key={item.href}>
            <a href={item.href} className="home-next-card">
              <span className="home-next-title">{item.title}</span>
              <span className="home-next-body">{item.body}</span>
            </a>
          </li>
        ))}
      </ul>

    <br/>
      <a href={JOBS_FOR_TODAY.href} className="home-next-card">
        <span className="home-next-title">Jobs for today</span>
        <span className="home-next-body">{JOBS_FOR_TODAY.body}</span>
      </a>
    </section>
  );
}
