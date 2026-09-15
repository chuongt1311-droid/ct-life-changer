import { createServerSupabase } from '@/lib/supabase/server';
import { isOwner } from '@/lib/auth/isOwner';
import type { RepositoryClient } from '@/lib/db/repository';
import { getPlayerCard } from '@/lib/db/progressDays';
import { settingsToDomain } from '@/lib/db/settingsMapping';
import { repositories } from '@/lib/db/repositories';
import { planClock } from '@/core/time';
import { ATTRS } from '@/core/progression/xp';
import { Placard } from '@/components/ui/Placard';
import { AttributeRow } from '@/components/ui/AttributeRow';
import { BadgeMedallion } from '@/components/ui/BadgeMedallion';
import { ThumbBar } from '@/components/ui/ThumbBar';
import { Icon } from '@/components/icons/Icon';
import Link from 'next/link';

export default async function CardPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isOwner(user.email)) {
    return (
      <main className="shell" data-phase="night">
        <p className="note">Not signed in.</p>
      </main>
    );
  }

  const client = supabase as unknown as RepositoryClient;
  const settingsRow = await repositories(client).settings.get();
  const settings = settingsToDomain(settingsRow!);
  const { planDate } = planClock(new Date(), settings.timezone);
  const card = await getPlayerCard(client, planDate);

  const byRating = [...ATTRS].sort((a, b) => card.attributes[b].rating - card.attributes[a].rating);

  return (
    <main className="shell" data-phase="dusk">
      <header className="dept-head">
        <p className="placard phase-label">
          <span className="dot" /> Player file
        </p>
      </header>
      <section className="next" aria-labelledby="ovr-head">
        <h1 className="next-name" id="ovr-head">
          {card.ovr}
        </h1>
        <p className="next-when">
          <span className="lead">Overall</span>
          <span className="form-read">
            <span className="label">{card.form.label}</span>
          </span>
        </p>
        <p className="next-note">The mean of six attributes, each between 40 and 99. Attributes never fall.</p>
      </section>
      <div className="stepback">
        <Placard>Attributes</Placard>
        <ul className="attrs">
          {byRating.map((attr) => (
            <AttributeRow
              key={attr}
              attr={attr}
              rating={card.attributes[attr].rating}
              intoLevel={card.attributes[attr].intoLevel}
              toNext={card.attributes[attr].toNext}
            />
          ))}
        </ul>

        <Placard>Badges</Placard>
        <ul className="medals">
          {card.badges.map((b) => (
            <BadgeMedallion key={b.id} badge={b} />
          ))}
        </ul>
        <p className="empty">Every badge counts a total, never days in a row. A gap costs you nothing but the days you did not log.</p>
      </div>
      <ThumbBar>
        <Link className="btn btn-main" href="/">
          <Icon name="moved" />
          Back to today
        </Link>
        <Link className="btn" href="/mentor">
          Ask the mentor
        </Link>
      </ThumbBar>
    </main>
  );
}
