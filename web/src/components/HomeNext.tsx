import { HOME_NEXT } from '../landing/copy';

export function HomeNext() {
  return (
    <section className="home-next" aria-labelledby="next">
      <h2 id="next">Where to go next</h2>
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
    </section>
  );
}
