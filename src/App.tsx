import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode, ChangeEvent, MouseEvent } from "react";
import { Icon28ArrowLeftOutline, Icon28ChevronRightOutline } from "@vkontakte/icons";
import { Button, Input, Textarea, Card, Div, Title, Text, Separator } from "@vkontakte/vkui";
import { db, total } from "./store";
import { api, hasApi } from "./api";
import type { Role } from "./api";
import type { Score, Submission } from "./types";
import { criteria } from "./types";

// Resolves a public/ asset against the configured base path (see vite.config.ts / VITE_BASE),
// so images work whether the app is served at the domain root or under a subpath.
const asset = (path: string) => import.meta.env.BASE_URL + path;

// Poster numbers are sequential (1, 2, 3...) but always shown 3 digits wide
// ("#001") so the display doesn't shrink and grow as the contest fills up.
const posterLabel = (n: number) => String(n).padStart(3, "0");

type View = "home" | "exhibition" | "join" | "jury" | "admin" | "results" | "about" | "poster";
const nav: [View, string, string][] = [
  ["home", "Главная", "⌂"],
  ["exhibition", "Выставка", "▧"],
  ["join", "Участнику", "＋"],
  ["results", "Результаты", "◉"],
  ["about", "О конкурсе", "i"],
];

function Logo() {
  return (
    <div className="logo">
      <img className="collegeLogo" src={asset("college-logo.webp")} alt="Московский финансовый колледж" />
    </div>
  );
}
function Header({ view, setView }: { view: View; setView: (v: View) => void }) {
  return (
    <header className="topbar">
      <button className="mobileBack" onClick={() => setView("home")}>
        <Icon28ArrowLeftOutline />
      </button>
      <Logo />
      <nav className="nav">
        {nav.map(([id, label, icon]) => (
          <button key={id} className={view === id ? "active" : ""} onClick={() => setView(id)}>
            <i>{icon}</i>
            {label}
          </button>
        ))}
      </nav>
    </header>
  );
}
function Hero({ setView }: { setView: (v: View) => void }) {
  return (
    <section className="hero">
      <div className="heroCopy">
        <div className="eyebrow">WORLD SAVINGS DAY · OCTOBER 31</div>
        <h1>
          SAVE <em>THE FUTURE</em>
        </h1>
        <div className="sub">AI DIGITAL POSTER CHALLENGE</div>
        <p>Smart choices today. A more secure tomorrow.</p>
        <div className="pillrow">
          <span>FINANCIAL LITERACY</span>
          <span>INNOVATION WITH AI</span>
          <span>BRIGHTER OPPORTUNITIES</span>
        </div>
      </div>
      <div className="heroArt">
        <div className="chart">
          <span>+24%</span>
          <div className="bars">
            <i />
            <i />
            <i />
            <i />
            <i />
          </div>
        </div>
        <div className="coin c1">₽</div>
        <div className="coin c2">$</div>
        <div className="pig">◒</div>
      </div>
      <div className="heroActions">
        <Button mode="primary" size="l" onClick={() => setView("exhibition")}>
          Смотреть работы <Icon28ChevronRightOutline />
        </Button>
        <Button mode="secondary" size="l" onClick={() => setView("join")}>
          Подать работу
        </Button>
      </div>
    </section>
  );
}
function ApprovedCover({ setView }: { setView: (v: View) => void }) {
  const labels = {
    home: "Главная",
    exhibition: "Выставка",
    join: "Участнику",
    results: "Результаты",
    about: "О конкурсе",
    watch: "СМОТРЕТЬ РАБОТЫ",
    submit: "ПОДАТЬ РАБОТУ",
    outcomes: "ИТОГИ КОНКУРСА",
    goals: "ЦЕЛИ И НОМИНАЦИИ",
    headline: "AI DIGITAL POSTER CHALLENGE",
    tagline: "Smart choices today. A more secure tomorrow.",
    pill: "WORLD SAVINGS DAY · OCTOBER 31",
    f1: "FINANCIAL LITERACY",
    f2: "INNOVATION WITH AI",
    f3: "BRIGHTER OPPORTUNITIES",
    foot: "© 2026 SAVE 4 THE FUTURE · VSproduction",
  };
  const links: [View, string][] = [
    ["home", labels.home],
    ["exhibition", labels.exhibition],
    ["join", labels.join],
    ["results", labels.results],
    ["about", labels.about],
  ];
  const cards: [View, string, string, string][] = [
    ["exhibition", labels.exhibition, labels.watch, "01"],
    ["join", labels.join, labels.submit, "02"],
    ["results", labels.results, labels.outcomes, "03"],
    ["about", labels.about, labels.goals, "04"],
  ];
  return (
    <main className="coverPage">
      <div className="coverShell">
        <header className="coverNav">
          <button className="coverLogo" onClick={() => setView("home")} aria-label="Главная">
            <img src={asset("college-logo.webp")} alt="Московский финансовый колледж" />
          </button>
          <nav className="coverNavLinks">
            {links.map(([id, label]) => (
              <button key={id} className={id === "home" ? "isActive" : ""} onClick={() => setView(id)}>
                <span className="coverNavIcon">{id === "home" ? "⌂" : id === "exhibition" ? "▧" : id === "join" ? "＋" : id === "results" ? "▥" : "ⓘ"}</span>
                {label}
              </button>
            ))}
          </nav>
        </header>
        <section className="coverHero">
          <div className="coverCopy">
            <div className="coverKicker">WORLD SAVINGS DAY · OCTOBER 31</div>
            <h1>
              <span>SAVE 4</span>
              <br />
              <strong>
                THE <em>FUTURE</em>
              </strong>
            </h1>
            <div className="coverSub">{labels.headline}</div>
            <p>{labels.tagline}</p>
            <button className="coverPill" onClick={() => setView("exhibition")}>
              <span>▣</span>
              {labels.pill}
              <b>›</b>
            </button>
            <div className="coverThemes">
              <div>
                <i>◉</i>
                <span>{labels.f1}</span>
              </div>
              <div>
                <i>✦</i>
                <span>{labels.f2}</span>
              </div>
              <div>
                <i>▥</i>
                <span>{labels.f3}</span>
              </div>
            </div>
          </div>
          <div className="coverPhoto" aria-hidden="true">
            <img src={asset("approved-cover-final.webp")} alt="" />
            <div className="coverPhotoOverlay" />
            <div className="coverPhotoWords"></div>
          </div>
        </section>
        <section className="coverCards">
          {cards.map(([id, title, sub, no]) => (
            <button key={id} className={"coverCard card-" + no} onClick={() => setView(id)}>
              <span className="coverCardNo">{no}</span>
              <span className="coverCardIcon">{id === "exhibition" ? "▧" : id === "join" ? "▤" : id === "results" ? "♜" : "ⓘ"}</span>
              <b>{title}</b>
              <small>{sub}</small>
              <span className="coverCardArrow">›</span>
            </button>
          ))}
        </section>
        <footer className="coverFooter">
          <span>{labels.foot}</span>
        </footer>
      </div>
    </main>
  );
}
function Home({ setView }: { setView: (v: View) => void }) {
  return (
    <>
      <Hero setView={setView} />
      <div className="featureGrid">
        {[
          ["ВЫСТАВКА", "СМОТРЕТЬ РАБОТЫ", "▧", "exhibition"],
          ["УЧАСТНИКУ", "ПОДАТЬ РАБОТУ", "＋", "join"],
          ["РЕЗУЛЬТАТЫ", "ИТОГИ КОНКУРСА", "◉", "results"],
          ["О КОНКУРСЕ", "ЦЕЛИ И НОМИНАЦИИ", "i", "about"],
        ].map(([a, b, c, v]) => (
          <button className="feature" key={v} onClick={() => setView(v as View)}>
            <span>{c}</span>
            <b>{a}</b>
            <small>{b}</small>
          </button>
        ))}
      </div>
      <footer>© 2026 SAVE 4 THE FUTURE | VSproduction</footer>
    </>
  );
}
function Page({ title, lead, children }: { title: string; lead?: string; children?: ReactNode }) {
  return (
    <main className="page">
      <div className="pageHead">
        <Title level="1">{title}</Title>
        {lead && <Text className="lead">{lead}</Text>}
      </div>
      {children}
    </main>
  );
}
function PosterCard({ w, onClick }: { w: Submission; onClick: () => void }) {
  const [reacted, setReacted] = useState(false);
  const [reacting, setReacting] = useState(false);
  const [audience, setAudience] = useState(w.audience);

  useEffect(() => {
    setReacted(!!localStorage.getItem("reacted:" + w.id));
    setAudience(w.audience);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w.id]);

  const react = async (e: MouseEvent) => {
    e.stopPropagation(); // don't also trigger the card's onClick (open the poster)
    if (reacted || reacting) return;
    setReacting(true);
    try {
      if (hasApi()) {
        const r = await api.reaction(w.id);
        setAudience(r.audience);
      } else {
        setAudience(db.react(w.id));
      }
      setReacted(true);
      localStorage.setItem("reacted:" + w.id, "1");
    } catch {
      /* the visitor can just try again */
    } finally {
      setReacting(false);
    }
  };

  return (
    <Card className="posterCard" onClick={onClick}>
      <div className="posterVisual">
        {w.imageUrl ? (
          <img src={w.imageUrl} />
        ) : (
          <>
            <span className="posterNo">#{posterLabel(w.posterNo)}</span>
            <strong>{w.title}</strong>
            <small>{w.idea}</small>
          </>
        )}
      </div>
      <Div>
        <Text weight="2">
          #{posterLabel(w.posterNo)} · {w.interactive ? "INTERACTIVE" : "DIGITAL POSTER"}
        </Text>
        {w.author && (
          <Text className="posterAuthor">
            {w.author}
            {w.group ? " · " + w.group : ""}
          </Text>
        )}
        <button
          className="posterMoreBtn"
          onClick={(e: MouseEvent) => {
            e.stopPropagation(); // the card's own onClick does the same thing — avoid firing it twice
            onClick();
          }}
        >
          Подробнее <span>→</span>
        </button>
        <button
          className={reacted ? "reactionBtn reactionBtn-compact reactionBtn-done" : "reactionBtn reactionBtn-compact"}
          onClick={react}
          disabled={reacted || reacting}
        >
          <span>{reacted ? "❤" : "♡"}</span>
          «Этот постер заставил меня задуматься»
          <b>{audience}</b>
        </button>
      </Div>
    </Card>
  );
}

// Loads published/winner posters — from the live backend when it's configured, otherwise
// from the local browser demo store (useful for previewing the interface without a deployment).
function usePublicWorks(): Submission[] {
  const [works, setWorks] = useState<Submission[]>([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (hasApi()) {
        try {
          const list = await api.submissions();
          if (!cancelled) setWorks(list.filter((x) => x.status === "published" || x.status === "winner"));
          return;
        } catch {
          /* fall through to demo store */
        }
      }
      if (!cancelled) setWorks(db.submissions().filter((x) => x.status === "published" || x.status === "winner"));
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return works;
}

// Manual-advance slideshow ("gallery mode") for the exhibition: one poster at
// a time, full size, with its idea/author underneath and prev/next controls
// (buttons, swipe, or arrow keys) instead of the grid of small cards.
function GallerySlideshow({ works, onClose }: { works: Submission[]; onClose: () => void }) {
  const [i, setI] = useState(0);
  const w = works[i];
  const [reacted, setReacted] = useState(false);
  const [reacting, setReacting] = useState(false);
  const [audience, setAudience] = useState(0);
  const touchX = useRef<number | null>(null);

  const go = (delta: number) => setI((cur) => (cur + delta + works.length) % works.length);

  useEffect(() => {
    if (!w) return;
    setReacted(!!localStorage.getItem("reacted:" + w.id));
    setAudience(w.audience);
  }, [w?.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [works.length]);

  const react = async () => {
    if (!w || reacted || reacting) return;
    setReacting(true);
    try {
      const next = hasApi() ? (await api.reaction(w.id)).audience : db.react(w.id);
      setAudience(next);
      setReacted(true);
      localStorage.setItem("reacted:" + w.id, "1");
    } catch {
      /* the visitor can just try again */
    } finally {
      setReacting(false);
    }
  };

  if (!w) return null;
  return (
    <div className="gallerySlideshow">
      <div className="slideTop">
        <span className="slideCounter">
          {i + 1} / {works.length}
        </span>
        <button className="slideClose" onClick={onClose}>
          ✕ К сетке
        </button>
      </div>
      <div
        className="slideStage"
        onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchX.current === null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          if (dx > 50) go(-1);
          else if (dx < -50) go(1);
          touchX.current = null;
        }}
      >
        <button className="slideNav slideNavPrev" onClick={() => go(-1)} aria-label="Предыдущий постер" disabled={works.length < 2}>
          ‹
        </button>
        <div className="slideImage">
          {w.imageUrl ? (
            <img src={w.imageUrl} alt={w.title} />
          ) : (
            <div className="posterVisual big">
              <strong>{w.title}</strong>
              <small>{w.idea}</small>
            </div>
          )}
        </div>
        <button className="slideNav slideNavNext" onClick={() => go(1)} aria-label="Следующий постер" disabled={works.length < 2}>
          ›
        </button>
      </div>
      <div className="slideInfo">
        <span className="slideNo">
          #{posterLabel(w.posterNo)}
          {w.interactive ? " · INTERACTIVE" : " · DIGITAL POSTER"}
        </span>
        <h2>{w.title}</h2>
        {w.author && (
          <div className="slideAuthor">
            {w.author}
            {w.group ? " · " + w.group : ""}
          </div>
        )}
        <p>{w.idea}</p>
        <button className={reacted ? "reactionBtn reactionBtn-done" : "reactionBtn"} onClick={react} disabled={reacted || reacting}>
          <span>{reacted ? "❤" : "♡"}</span>
          «Этот постер заставил меня задуматься»
          <b>{audience}</b>
        </button>
      </div>
    </div>
  );
}

function Exhibition({ setView }: { setView: (v: View) => void }) {
  const works = usePublicWorks();
  const [mode, setMode] = useState<"grid" | "slides">("grid");
  return (
    <Page title="Цифровая выставка" lead="Работы участников. Авторы скрыты на этапе оценки.">
      <div className="filters">
        <Button mode="secondary">Все</Button>
        <Button mode="secondary">AI poster</Button>
        <Button mode="secondary">Interactive</Button>
        <Button
          mode={mode === "slides" ? "primary" : "secondary"}
          onClick={() => setMode(mode === "slides" ? "grid" : "slides")}
          disabled={works.length === 0}
        >
          {mode === "slides" ? "Сетка" : "Режим галереи"}
        </Button>
      </div>
      {mode === "slides" ? (
        <GallerySlideshow works={works} onClose={() => setMode("grid")} />
      ) : (
        <div className="posterGrid">
          {works.map((w) => (
            <PosterCard
              key={w.id}
              w={w}
              onClick={() => {
                sessionStorage.setItem("poster", w.id);
                setView("poster");
              }}
            />
          ))}
        </div>
      )}
    </Page>
  );
}

const emptyForm = { title: "", idea: "", problem: "", author: "", group: "", contact: "", tools: "", aiHow: "", contribution: "", interactiveUrl: "" };

const joinNominations = [
  "GRAND PRIX",
  "BEST COMMUNICATION IDEA",
  "BEST ENGLISH POSTER",
  "BEST DIGITAL DESIGN",
  "BEST INTERACTIVE POSTER",
];

const joinSteps: [string, string][] = [
  ["Определить идею и проблему", "Выбрать тему, связанную со Днём всемирной экономии (сбережения, финансовая грамотность, устойчивое будущее и т. п.), сформулировать проблему и основную идею постера."],
  ["Создать постер с использованием ИИ", "Использовать один или несколько инструментов искусственного интеллекта для создания визуала и/или текста, при этом внести и собственный творческий вклад."],
  ["Подготовить файл изображения", "Сохранить готовый постер в формате PNG, JPEG или WEBP, проверить, что размер файла не превышает 10 МБ."],
  ["Открыть сайт конкурса", "Перейти в раздел подачи заявки на этой странице."],
  ["Заполнить форму заявки", "Указать название, проблему, основную идею, инструменты ИИ, подробно описать, как именно использовался ИИ, и что сделано самостоятельно (AI Creative Passport). При наличии интерактивного элемента — указать ссылку на него."],
  ["Загрузить файл постера", "Прикрепить готовое изображение в форму."],
  ["Отправить заявку", "Запомнить или сохранить присвоенный номер постера — он понадобится для отслеживания статуса."],
  ["Дождаться результата модерации", "Организатор проверит заявку и присвоит один из статусов: «ОПУБЛИКОВАНО» (заявка принята и допущена к судейству), «НА ДОРАБОТКУ» (нужно исправить и подать заново) или «ОТКЛОНЕНО»."],
  ["Если пришёл статус «НА ДОРАБОТКУ»", "Внести исправления по замечаниям и подать заявку повторно."],
  ["Дождаться завершения этапа судейства", "После того как жюри оценит все опубликованные постеры, организатор подводит итоги."],
  ["Проверить результаты", "В публичном разделе результатов на сайте после публикации итогов конкурса, до 31 октября 2026 года включительно (дедлайн приёма заявок) и далее по срокам, объявленным организатором для этапа судейства."],
];

function JoinRequirements() {
  return (
    <div className="reqTab">
      <Card className="reqCard">
        <Div>
          <Title level="3">Требования к постеру</Title>
          <ul className="reqList">
            <li><b>Формат изображения:</b> PNG, JPEG или WEBP.</li>
            <li><b>Максимальный размер файла:</b> 10 МБ.</li>
            <li><b>Язык основного текста на постере:</b> английский. Рекомендуемый объём текста на самом постере — не более 35 слов (заголовок, короткое сообщение, визуальная идея, призыв к действию или вопрос).</li>
            <li>Использование инструментов искусственного интеллекта не только разрешено, но и является частью конкурса — важно честно и подробно описать, как именно ИИ был использован.</li>
            <li>К каждой заявке прикладывается «AI Creative Passport» — короткое описание того, что автор сделал самостоятельно, в дополнение к работе ИИ.</li>
          </ul>
        </Div>
      </Card>

      <Card className="reqCard">
        <Div>
          <Title level="3">Поля формы заявки</Title>
          <ul className="reqList">
            <li><b>Название постера</b> — обязательно.</li>
            <li><b>Проблема / тема</b> — какую проблему или тему поднимает постер.</li>
            <li><b>Основная идея / сообщение</b> — обязательно; ключевой посыл постера.</li>
            <li><b>Инструменты ИИ</b>, которые использовались.</li>
            <li><b>Как именно использовался ИИ</b> — обязательно; подробное описание процесса работы с ИИ.</li>
            <li><b>Личный вклад автора</b> («AI Creative Passport») — что было сделано самостоятельно, без ИИ.</li>
            <li><b>Ссылка на интерактивный элемент</b> — необязательное поле, если у постера есть цифровая интерактивная составляющая.</li>
            <li><b>Файл изображения постера</b> — загрузка самого постера.</li>
          </ul>
          <Text className="hint">Обязательными для отправки являются: название, идея, описание того, как использовался ИИ.</Text>
        </Div>
      </Card>

      <Card className="reqCard">
        <Div>
          <Title level="3">Критерии оценивания</Title>
          <Text>Жюри оценивает каждый опубликованный постер по пяти критериям, каждый — от 0 до 20 баллов, итог — до 100 баллов:</Text>
          <ol className="reqList reqListOrdered">
            {criteria.map(([key, label]) => (
              <li key={key}>{label}</li>
            ))}
          </ol>
        </Div>
      </Card>

      <Card className="reqCard">
        <Div>
          <Title level="3">Номинации конкурса</Title>
          <ul className="reqList">
            {joinNominations.map((n) => (
              <li key={n}>{n}</li>
            ))}
            <li>Отдельно — <b>AUDIENCE CHOICE</b> (зрительская реакция не влияет на оценку жюри и считается отдельно).</li>
          </ul>
        </Div>
      </Card>

      <Card className="reqCard">
        <Div>
          <Title level="3">Пошаговый алгоритм действий</Title>
          <ol className="reqSteps">
            {joinSteps.map(([title, body], i) => (
              <li key={i}>
                <b>{title}.</b> <span>{body}</span>
              </li>
            ))}
          </ol>
        </Div>
      </Card>
    </div>
  );
}

function Join() {
  const [tab, setTab] = useState<"form" | "requirements">("form");
  const [f, setF] = useState(emptyForm);
  const [file, setFile] = useState<File | null>(null);
  const [done, setDone] = useState(false);
  const [posterNo, setPosterNo] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const u = (k: keyof typeof f) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0] || null;
    if (picked && picked.size > 10 * 1024 * 1024) {
      setError("Файл больше 10 МБ — выберите файл поменьше.");
      return;
    }
    setError("");
    setFile(picked);
  };
  const submit = async () => {
    setError("");
    if (!f.title || !f.idea || !f.aiHow) {
      setError("Заполните название постера, главную идею и способ использования AI.");
      return;
    }
    setSending(true);
    try {
      if (hasApi()) {
        const r = await api.createSubmission(f);
        if (file) {
          try {
            await api.uploadImage(r.id, file);
          } catch {
            setError("Текст работы отправлен, но файл постера загрузить не удалось. Пришлите его организатору отдельно.");
          }
        }
        setPosterNo(r.posterNo);
      } else {
        const id = crypto.randomUUID();
        const existing = db.submissions();
        const no = existing.length ? Math.max(...existing.map((s) => s.posterNo)) + 1 : 1;
        db.add({ id, posterNo: no, ...f, interactive: !!f.interactiveUrl, status: "moderation", createdAt: new Date().toISOString(), audience: 0 });
        setPosterNo(no);
      }
      setDone(true);
    } catch {
      setError("Не удалось отправить работу. Проверьте соединение и попробуйте ещё раз.");
    } finally {
      setSending(false);
    }
  };
  return (
    <Page title="Подать работу" lead="Один конкурсный постер. Одна сильная идея. Один главный посыл.">
      <div className="filters">
        <Button mode={tab === "form" ? "primary" : "secondary"} onClick={() => setTab("form")}>
          Форма заявки
        </Button>
        <Button mode={tab === "requirements" ? "primary" : "secondary"} onClick={() => setTab("requirements")}>
          Требования и критерии
        </Button>
      </div>
      {tab === "requirements" && <JoinRequirements />}
      {tab === "form" && (
      <Card className="formCard">
        <Input value={f.author} onChange={u("author")} placeholder="Имя и фамилия" />
        <Input value={f.group} onChange={u("group")} placeholder="Группа / курс" />
        <Input value={f.contact} onChange={u("contact")} placeholder="Контакт" />
        <Input value={f.title} onChange={u("title")} placeholder="Poster title · English" />
        <Textarea value={f.problem} onChange={u("problem")} placeholder="Какую проблему, связанную со сбережениями, вы хотите поднять?" />
        <Textarea value={f.idea} onChange={u("idea")} placeholder="Главная идея / message" />
        <Text className="hint">На постере: английский заголовок, короткое сообщение, визуальная концепция, призыв к действию или вопрос. Рекомендуемый объём основного текста — до 35 слов.</Text>
        <Input value={f.tools} onChange={u("tools")} placeholder="Какие AI-инструменты использовали?" />
        <Textarea value={f.aiHow} onChange={u("aiHow")} placeholder="Генерация идей, английский текст, изображение, редактирование, композиция..." />
        <Textarea value={f.contribution} onChange={u("contribution")} placeholder="Что сделали самостоятельно?" />
        <Input value={f.interactiveUrl} onChange={u("interactiveUrl")} placeholder="Ссылка на интерактивный элемент · optional" />
        <label className="fileField">
          <span>Файл постера · PNG / JPEG / WEBP до 10 МБ</span>
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onFile} />
          {file && <small>{file.name}</small>}
        </label>
        {error && <Text className="error">{error}</Text>}
        <Button stretched size="l" mode="primary" onClick={submit} disabled={sending}>
          {sending ? "Отправляем…" : "Отправить на модерацию"}
        </Button>
        {done && (
          <div className="success">
            Работа отправлена{posterNo ? ` · номер #${posterLabel(posterNo)}` : ""}. Статус: SUBMITTED → ожидает модерации.
          </div>
        )}
      </Card>
      )}
    </Page>
  );
}

// Shared login gate for the jury and admin areas. Participants never see this — the two
// hidden entry points (?view=jury and ?view=admin) are shared privately by the organizer.
function AuthGate({
  requiredRole,
  title,
  lead,
  children,
}: {
  requiredRole: Role;
  title: string;
  lead: string;
  children: (me: { name: string; role: Role; logout: () => void }) => ReactNode;
}) {
  const [status, setStatus] = useState<"loading" | "signedOut" | "denied" | "ok">("loading");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("jury");
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  const refresh = async () => {
    if (!hasApi()) {
      setStatus("signedOut");
      return;
    }
    try {
      const me = await api.me();
      if (!me.authenticated || !me.role) {
        setStatus("signedOut");
        return;
      }
      const allowed = me.role === requiredRole || (requiredRole === "jury" && me.role === "organizer");
      if (!allowed) {
        setStatus("denied");
        return;
      }
      setName(me.displayName || "");
      setRole(me.role);
      setStatus("ok");
    } catch {
      setStatus("signedOut");
    }
  };
  useEffect(() => {
    refresh();
  }, []);

  const login = async () => {
    setError("");
    setChecking(true);
    try {
      await api.login(form.username, form.password);
      await refresh();
    } catch {
      setError("Неверный логин или пароль.");
    } finally {
      setChecking(false);
    }
  };
  const logout = async () => {
    try {
      await api.logout();
    } catch {
      /* ignore */
    }
    setStatus("signedOut");
    setForm({ username: "", password: "" });
  };

  if (status === "loading") {
    return (
      <Page title={title}>
        <Card className="juryGate">
          <Text>Проверяем доступ…</Text>
        </Card>
      </Page>
    );
  }
  if (status === "ok") return <>{children({ name, role, logout })}</>;
  if (status === "denied") {
    return (
      <Page title={title} lead="Этот раздел не является публичной частью конкурса.">
        <Card className="juryGate">
          <div className="gateIcon">🔒</div>
          <Title level="2">Доступ ограничен</Title>
          <Text>Ваш аккаунт не имеет прав для этого раздела.</Text>
          <Button mode="secondary" onClick={logout}>
            Выйти и войти под другим аккаунтом
          </Button>
        </Card>
      </Page>
    );
  }
  if (!hasApi()) {
    return (
      <Page title={title} lead="Раздел работает только при подключённом бэкенде (VITE_API_URL).">
        <Card className="juryGate">
          <Text>В демо-режиме без backend вход недоступен.</Text>
        </Card>
      </Page>
    );
  }
  return (
    <Page title={title} lead={lead}>
      <Card className="formCard">
        <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="Логин" />
        <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Пароль" />
        <Button stretched size="l" mode="primary" onClick={login} disabled={checking}>
          {checking ? "Входим…" : "Войти"}
        </Button>
        {error && <Text className="error">{error}</Text>}
      </Card>
    </Page>
  );
}

function Jury() {
  return (
    <AuthGate requiredRole="jury" title="Жюри" lead="Доступ к оцениванию открыт только членам жюри.">
      {({ name, logout }) => <JuryWorkspace name={name} logout={logout} />}
    </AuthGate>
  );
}

const juryCriteriaHelp: Record<string, string> = {
  idea: "Насколько ясно и убедительно постер доносит мысль: понятна ли идея с первого взгляда, работает ли она на тему Дня сбережений.",
  english: "Грамотность и естественность английского языка: орфография, грамматика, уместность формулировок.",
  originality: "Насколько концепция нестандартна и запоминающаяся, а не повторяет типовые решения.",
  design: "Визуальная композиция, читаемость, цвет, баланс текста и изображения.",
  digital: "Насколько осмысленно и уместно использованы ИИ и цифровые инструменты — не просто «есть ИИ», а как он усилил идею.",
};

function JuryInstructions() {
  const [open, setOpen] = useState(false);
  return (
    <Card className="juryHelp">
      <Div>
        <button className="juryHelpToggle" onClick={() => setOpen((v) => !v)}>
          <b>Памятка: как выставлять оценки</b>
          <span>{open ? "Свернуть ▲" : "Показать ▼"}</span>
        </button>
        {open && (
          <div className="juryHelpBody">
            <Text>
              Каждая работа оценивается по пяти критериям от 0 до 20 баллов (итог — до 100). Оцените каждую работу
              один раз и сохраните оценку кнопкой «Сохранить оценку». Автор, группа и контакты скрыты намеренно —
              оценивание анонимное.
            </Text>
            <ul className="juryHelpList">
              {criteria.map(([key, label]) => (
                <li key={key}>
                  <b>{label}</b>
                  <span>{juryCriteriaHelp[key]}</span>
                </li>
              ))}
            </ul>
            <Text>
              Ориентир по баллам внутри каждого критерия: 17–20 — отлично, 11–16 — хорошо с замечаниями, 6–10 —
              слабо выражено, 0–5 — критерий практически не раскрыт.
            </Text>
          </div>
        )}
      </Div>
    </Card>
  );
}

function JuryWorkspace({ name, logout }: { name: string; logout: () => void }) {
  const [works, setWorks] = useState<Submission[]>([]);
  const [selected, setSelected] = useState("");
  const [score, setScore] = useState<Score>({ idea: 10, english: 10, originality: 10, design: 10, digital: 10 });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await api.submissions();
        if (!cancelled) setWorks(list.filter((x) => x.status === "published" || x.status === "winner"));
      } catch {
        /* keep empty list on failure */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const current = works.find((w) => w.id === selected);
  const save = async () => {
    if (!current) return;
    setError("");
    try {
      await api.score(current.id, score);
      setSaved(true);
    } catch {
      setError("Не удалось сохранить оценку. Проверьте соединение и попробуйте ещё раз.");
    }
  };

  return (
    <Page title="Рабочее пространство жюри" lead={`Вы вошли как ${name || "член жюри"}. Автор, группа и контакты скрыты до завершения оценивания.`}>
      <Button mode="secondary" size="s" onClick={logout}>
        Выйти
      </Button>
      <JuryInstructions />
      <div className="juryWorkspace">
        <aside className="juryList">
          <div className="juryListHead">
            <span>РАБОТЫ</span>
            <b>{works.length}</b>
          </div>
          {works.map((w, i) => (
            <button
              className={selected === w.id ? "juryWork selected" : "juryWork"}
              onClick={() => {
                setSelected(w.id);
                setSaved(false);
                setError("");
              }}
              key={w.id}
            >
              <span>#{posterLabel(w.posterNo)}</span>
              <b>Работа {i + 1}</b>
              <small>{w.interactive ? "INTERACTIVE" : "DIGITAL POSTER"}</small>
            </button>
          ))}
        </aside>
        <section className="juryWorkspaceMain">
          {current ? (
            <>
              <div className="juryPosterStage">
                {current.imageUrl ? (
                  <img src={current.imageUrl} alt={"Постер #" + posterLabel(current.posterNo)} />
                ) : (
                  <div className="juryPosterPlaceholder">
                    <span>#{posterLabel(current.posterNo)}</span>
                    <strong>{current.title}</strong>
                    <small>{current.idea}</small>
                  </div>
                )}
              </div>
              <div className="juryMeta">
                <span>ПОСТЕР #{posterLabel(current.posterNo)}</span>
                <span>АВТОР: СКРЫТ</span>
                <span>КОНТАКТЫ: СКРЫТЫ</span>
              </div>
              <div className="juryScores">
                {criteria.map(([key, label]) => (
                  <div className="juryScore" key={key}>
                    <div>
                      <b>{label}</b>
                      <span>0–20</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="20"
                      value={score[key]}
                      onChange={(e) => {
                        setScore({ ...score, [key]: +e.target.value });
                        setSaved(false);
                      }}
                    />
                    <strong>{String(score[key]).padStart(2, "0")}</strong>
                  </div>
                ))}
              </div>
              <div className="juryTotal">
                <div>
                  <span>ИТОГО</span>
                  <b>{total(score)} / 100</b>
                </div>
                <Button size="l" mode="primary" onClick={save}>
                  Сохранить оценку
                </Button>
                {saved && <small>Оценка сохранена</small>}
                {error && <Text className="error">{error}</Text>}
              </div>
            </>
          ) : (
            <div className="juryEmpty">
              <span>SELECT A POSTER</span>
              <h2>Выберите работу</h2>
              <p>После выбора здесь появится только материал, необходимый для объективной оценки.</p>
            </div>
          )}
        </section>
      </div>
    </Page>
  );
}

function Admin() {
  return (
    <AuthGate requiredRole="organizer" title="Админ-панель" lead="Вход только для организатора конкурса.">
      {({ name, logout }) => <AdminWorkspace name={name} logout={logout} />}
    </AuthGate>
  );
}

const statusLabel: Record<Submission["status"], string> = {
  moderation: "НА МОДЕРАЦИИ",
  published: "ОПУБЛИКОВАНО",
  rework: "НА ДОРАБОТКУ",
  rejected: "ОТКЛОНЕНО",
  winner: "ПОБЕДИТЕЛЬ",
};

function AdminWorkspace({ name, logout }: { name: string; logout: () => void }) {
  const [tab, setTab] = useState<"moderation" | "accounts">("moderation");
  const [works, setWorks] = useState<Submission[]>([]);
  const [accounts, setAccounts] = useState<{ id: number; username: string; role: Role; display_name: string | null }[]>([]);
  const [newAccount, setNewAccount] = useState({ username: "", password: "", role: "jury" as Role });
  const [message, setMessage] = useState("");
  const [namesRevealed, setNamesRevealedState] = useState<boolean | null>(null);
  const [revealBusy, setRevealBusy] = useState(false);

  const loadWorks = async () => {
    try {
      setWorks(await api.adminSubmissions());
    } catch {
      /* ignore */
    }
  };
  const loadAccounts = async () => {
    try {
      setAccounts(await api.listAccounts());
    } catch {
      /* ignore */
    }
  };
  const loadSettings = async () => {
    try {
      setNamesRevealedState((await api.getSettings()).namesRevealed);
    } catch {
      /* ignore */
    }
  };
  useEffect(() => {
    loadWorks();
    loadAccounts();
    loadSettings();
  }, []);

  const setStatus = async (id: string, status: Submission["status"]) => {
    setMessage("");
    try {
      await api.setStatus(id, status);
      await loadWorks();
    } catch (e) {
      const reason = e instanceof Error ? e.message : "";
      if (reason === "unauthorized" || reason === "forbidden") {
        setMessage("Сессия администратора истекла — выйдите и войдите заново.");
      } else {
        setMessage("Не удалось изменить статус. Проверьте соединение и попробуйте ещё раз.");
      }
    }
  };
  const deleteWork = async (id: string, label: string) => {
    if (!window.confirm(`Удалить постер ${label} безвозвратно? Оценки жюри по нему тоже будут удалены, а номера остальных постеров пересчитаются.`)) {
      return;
    }
    setMessage("");
    try {
      await api.deleteSubmission(id);
      await loadWorks();
    } catch (e) {
      const reason = e instanceof Error ? e.message : "";
      if (reason === "unauthorized" || reason === "forbidden") {
        setMessage("Сессия администратора истекла — выйдите и войдите заново.");
      } else {
        setMessage("Не удалось удалить постер. Проверьте соединение и попробуйте ещё раз.");
      }
    }
  };
  const toggleNamesRevealed = async () => {
    if (namesRevealed === null) return;
    const next = !namesRevealed;
    if (next && !window.confirm("Открыть фамилии авторов всем посетителям сайта — в галерее, на страницах постеров и в результатах? Отменить это можно тем же переключателем.")) {
      return;
    }
    setRevealBusy(true);
    try {
      await api.setNamesRevealed(next);
      setNamesRevealedState(next);
    } catch {
      setMessage("Не удалось изменить видимость имён.");
    } finally {
      setRevealBusy(false);
    }
  };
  const createAccount = async () => {
    setMessage("");
    if (!newAccount.username || !newAccount.password) {
      setMessage("Укажите логин и пароль.");
      return;
    }
    try {
      await api.createAccount(newAccount.username, newAccount.password, newAccount.role);
      setNewAccount({ username: "", password: "", role: "jury" });
      setMessage("Аккаунт создан.");
      await loadAccounts();
    } catch {
      setMessage("Не удалось создать аккаунт — возможно, логин уже занят.");
    }
  };

  return (
    <Page title="Админ-панель" lead={`Вы вошли как ${name || "организатор"}.`}>
      <Button mode="secondary" size="s" onClick={logout}>
        Выйти
      </Button>
      <Card className={namesRevealed ? "revealCard revealCard-on" : "revealCard"}>
        <Div>
          <div className="revealHead">
            <div>
              <b>Имена авторов</b>
              <Text className="muted">
                {namesRevealed === null
                  ? "Проверяем состояние…"
                  : namesRevealed
                  ? "Открыты — видны в галерее, на страницах постеров и в результатах."
                  : "Скрыты — везде на сайте виден только номер постера, пока вы не откроете имена."}
              </Text>
            </div>
            <Button
              mode={namesRevealed ? "secondary" : "primary"}
              disabled={namesRevealed === null || revealBusy}
              onClick={toggleNamesRevealed}
            >
              {revealBusy ? "Обновляем…" : namesRevealed ? "Скрыть имена" : "Открыть имена"}
            </Button>
          </div>
        </Div>
      </Card>
      <div className="filters">
        <Button mode={tab === "moderation" ? "primary" : "secondary"} onClick={() => setTab("moderation")}>
          Модерация
        </Button>
        <Button mode={tab === "accounts" ? "primary" : "secondary"} onClick={() => setTab("accounts")}>
          Аккаунты жюри
        </Button>
      </div>
      {message && <Text className={message.startsWith("Аккаунт создан") ? "success" : "error"}>{message}</Text>}

      {tab === "moderation" ? (
        <div className="resultList">
          {works.map((w) => (
            <Card key={w.id}>
              <div className="adminRow">
                <div className="adminThumb">
                  {w.imageUrl ? <img src={w.imageUrl} alt={w.title} /> : <span>#{posterLabel(w.posterNo)}</span>}
                </div>
                <b>#{posterLabel(w.posterNo)}</b>
                <span>{w.title}</span>
                <small>
                  {w.author || "—"} · {w.group || "—"} · {w.contact || "—"}
                </small>
                <em>{statusLabel[w.status]}</em>
                <div className="adminActions">
                  <Button size="s" mode="primary" onClick={() => setStatus(w.id, "published")}>
                    Опубликовать
                  </Button>
                  <Button size="s" mode="secondary" onClick={() => setStatus(w.id, "rework")}>
                    На доработку
                  </Button>
                  <Button size="s" mode="secondary" onClick={() => setStatus(w.id, "rejected")}>
                    Отклонить
                  </Button>
                  <Button size="s" mode="secondary" onClick={() => setStatus(w.id, "winner")}>
                    Победитель
                  </Button>
                  <Button size="s" mode="secondary" appearance="negative" onClick={() => deleteWork(w.id, `#${posterLabel(w.posterNo)} «${w.title}»`)}>
                    Удалить
                  </Button>
                </div>
              </div>
            </Card>
          ))}
          {works.length === 0 && <Text className="muted">Работ пока нет.</Text>}
        </div>
      ) : (
        <Card className="formCard">
          <Title level="3">Новый аккаунт</Title>
          <Input value={newAccount.username} onChange={(e) => setNewAccount({ ...newAccount, username: e.target.value })} placeholder="Логин" />
          <Input type="password" value={newAccount.password} onChange={(e) => setNewAccount({ ...newAccount, password: e.target.value })} placeholder="Пароль" />
          <select className="roleSelect" value={newAccount.role} onChange={(e) => setNewAccount({ ...newAccount, role: e.target.value as Role })}>
            <option value="jury">Жюри</option>
            <option value="organizer">Админ</option>
          </select>
          <Button mode="primary" onClick={createAccount}>
            Создать аккаунт
          </Button>
          <Separator />
          <Title level="3">Существующие аккаунты</Title>
          {accounts.map((a) => (
            <Text key={a.id}>
              {a.username} — {a.role === "organizer" ? "админ" : "жюри"}
            </Text>
          ))}
          {accounts.length === 0 && <Text className="muted">Аккаунтов пока нет.</Text>}
        </Card>
      )}
    </Page>
  );
}

function Results() {
  const works = usePublicWorks();
  const [aggregated, setAggregated] = useState<Record<string, { total: number; juryCount: number }> | null>(null);
  useEffect(() => {
    (async () => {
      if (!hasApi()) return;
      try {
        const { results } = await api.results();
        const map: Record<string, { total: number; juryCount: number }> = {};
        results.forEach((r) => (map[r.id] = { total: Math.round(r.total), juryCount: r.juryCount }));
        setAggregated(map);
      } catch {
        /* keep demo fallback */
      }
    })();
  }, []);
  const scores = db.scores();
  return (
    <Page title="Результаты" lead="Итоги конкурса — среднее по всем членам жюри. Отдельная реакция аудитории не влияет на оценку.">
      <div className="resultList">
        {works.map((w) => {
          const fromApi = aggregated?.[w.id];
          const shown = fromApi ? `${fromApi.total} / 100 · ${fromApi.juryCount} оценок` : `${total(scores[w.id]) || "—"} / 100`;
          return (
            <Card key={w.id}>
              <div className="resultRow">
                <b>#{posterLabel(w.posterNo)}</b>
                <span>
                  {w.title}
                  {w.author && <small className="resultAuthor">{w.author}{w.group ? " · " + w.group : ""}</small>}
                </span>
                <strong>{shown}</strong>
              </div>
            </Card>
          );
        })}
      </div>
    </Page>
  );
}

function About() {
  return (
    <Page title="О конкурсе" lead="SAVE 4 THE FUTURE объединяет финансовую грамотность, английский язык, AI и цифровой дизайн.">
      <div className="aboutGrid">
        {[
          ["Задача", "Не сделать красивый постер о сбережениях, а создать постер, который заставляет задуматься о конкретной финансовой проблеме и действии."],
          ["Номинации", "GRAND PRIX · BEST COMMUNICATION IDEA · BEST ENGLISH POSTER · BEST DIGITAL DESIGN · BEST INTERACTIVE POSTER · отдельный AUDIENCE CHOICE."],
          ["Правила", "AI разрешён и является частью конкурса. Автор заполняет короткий AI Creative Passport. Реакция аудитории не влияет на оценку жюри."],
          ["5 критериев", "Communication idea · English language · Originality of concept · Visual design · Meaningful use of AI & digital technologies."],
        ].map(([h, t]) => (
          <Card className="aboutBlock" key={h}>
            <Title level="2">{h}</Title>
            <Text>{t}</Text>
          </Card>
        ))}
      </div>
    </Page>
  );
}

function Poster({ setView }: { setView: (v: View) => void }) {
  const [w, setW] = useState<Submission | null | undefined>(undefined);
  const [reacted, setReacted] = useState(false);
  const [reacting, setReacting] = useState(false);
  useEffect(() => {
    const id = sessionStorage.getItem("poster") || "";
    setReacted(!!localStorage.getItem("reacted:" + id));
    (async () => {
      if (hasApi()) {
        try {
          setW(await api.submission(id));
          return;
        } catch {
          /* fall through */
        }
      }
      setW(db.submissions().find((x) => x.id === id) || null);
    })();
  }, []);
  const react = async () => {
    if (!w || reacted || reacting) return;
    setReacting(true);
    try {
      const audience = hasApi() ? (await api.reaction(w.id)).audience : db.react(w.id);
      setW({ ...w, audience });
      setReacted(true);
      localStorage.setItem("reacted:" + w.id, "1");
    } catch {
      /* if it fails, the person can just try again */
    } finally {
      setReacting(false);
    }
  };
  if (w === undefined) return <Page title="Загрузка…" />;
  if (!w)
    return (
      <Page title="Работа не найдена">
        <Button onClick={() => setView("exhibition")}>К выставке</Button>
      </Page>
    );
  return (
    <Page title={"Постер #" + posterLabel(w.posterNo)} lead={w.author ? `${w.title} · ${w.author}${w.group ? " · " + w.group : ""}` : w.title}>
      <Card className="detailCard">
        <div className="posterDetail">
          {w.imageUrl ? (
            <img src={w.imageUrl} />
          ) : (
            <div className="posterVisual big">
              <strong>{w.title}</strong>
              <small>{w.idea}</small>
            </div>
          )}
        </div>
        <button className={reacted ? "reactionBtn reactionBtn-done" : "reactionBtn"} onClick={react} disabled={reacted || reacting}>
          <span>{reacted ? "❤" : "♡"}</span>
          «Этот постер заставил меня задуматься»
          <b>{w.audience}</b>
        </button>
        <Title level="3">AI Creative Passport</Title>
        <Text>
          <b>Инструменты:</b> {w.tools || "—"}
        </Text>
        <Text>
          <b>Как использовали AI:</b> {w.aiHow || "—"}
        </Text>
        <Text>
          <b>Что сделали самостоятельно:</b> {w.contribution || "—"}
        </Text>
        <Button mode="secondary" onClick={() => setView("exhibition")}>
          ← Назад к выставке
        </Button>
      </Card>
    </Page>
  );
}

export default function App() {
  const [view, setView] = useState<View>(() => {
    const requested = new URLSearchParams(window.location.search).get("view");
    return requested === "jury" || requested === "admin" ? (requested as View) : "home";
  });
  const body = useMemo(() => {
    switch (view) {
      case "home":
        return null;
      case "exhibition":
        return <Exhibition setView={setView} />;
      case "join":
        return <Join />;
      case "jury":
        return <Jury />;
      case "admin":
        return <Admin />;
      case "results":
        return <Results />;
      case "about":
        return <About />;
      case "poster":
        return <Poster setView={setView} />;
    }
  }, [view]);
  return <div className="app">{view === "home" ? <ApprovedCover setView={setView} /> : (
    <>
      <Header view={view} setView={setView} />
      {body}
    </>
  )}</div>;
}
