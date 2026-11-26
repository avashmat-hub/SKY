import React, { useState } from 'react';
import { X, ArrowUpRight, Check } from 'lucide-react';

export type StudioSection = 'work' | 'about' | 'journal' | 'contact' | null;

interface StudioDrawerProps {
  section: StudioSection;
  onClose: () => void;
}

const PROJECTS = [
  {
    id: '01',
    title: 'TRAVEL',
    url: 'https://skyrift.tilda.ws/shmatkov',
    displayUrl: 'skyrift.tilda.ws/shmatkov',
  },
  {
    id: '02',
    title: 'ЭКО КАПСУЛЫ',
    url: 'https://avashmat-hub.github.io/arch',
    displayUrl: 'avashmat-hub.github.io/arch',
  },
  {
    id: '03',
    title: 'В СКАЛЕ',
    url: 'https://avashmat-hub.github.io/sky-rift',
    displayUrl: 'avashmat-hub.github.io/sky-rift',
  },
  {
    id: '04',
    title: 'КОМПЛЕКС 1.0',
    url: 'https://sites.google.com/d/183_HC5ASWJzuQJgXRuwOMeAjTCBNagbK/p/1aZpeg1uBqMUqKPkqs7o7J8dEU0Ti7t9p/edit',
    displayUrl: 'sites.google.com/d/183_HC5A...Ti7t9p',
  },
  {
    id: '05',
    title: 'AETHER CANYON',
    url: 'https://skyrift.tilda.ws/bridge',
    displayUrl: 'skyrift.tilda.ws/bridge',
  },
];

export const StudioDrawer: React.FC<StudioDrawerProps> = ({ section, onClose }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  if (!section) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    setSubmitted(true);
  };

  return (
    <div
      className="drawer-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={section}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="drawer-panel" data-drawer-scroll="true">
        <div className="drawer-header">
          <span className="drawer-kicker">
            {section === 'about' && 'О бренде'}
            {section === 'journal' && 'История'}
            {section === 'contact' && 'Начать диалог'}
          </span>
          <button
            type="button"
            className="drawer-close"
            onClick={onClose}
            aria-label="Вернуться в SKY RIFT"
          >
            <span>SKY RIFT</span>
            <X size={16} strokeWidth={1.6} />
          </button>
        </div>

        {section === 'work' && (
          <div className="drawer-body">
            <div className="drawer-list">
              {PROJECTS.map((project) => (
                <article key={project.id} className="drawer-item">
                  <a
                    href={project.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="drawer-item-top drawer-item-link"
                  >
                    <span className="drawer-num">{project.id}.</span>
                    <div className="drawer-item-content">
                      <h3>{project.title}</h3>
                      <p className="drawer-meta">{project.displayUrl}</p>
                    </div>
                    <ArrowUpRight size={18} className="drawer-arrow" />
                  </a>
                </article>
              ))}
            </div>
          </div>
        )}

        {section === 'about' && (
          <div className="drawer-body">
            <div className="drawer-portrait-wrap">
              <img
                className="drawer-portrait"
                src="./assets/aistudio/bGbmMsQb4GPNsdNtT8s-h77J53oe1hvC4i-y-Kk7gJoisC1kJPVkbCTlGiDbKZi_jAN4-EbOA42LW3euDl2Y0kSt_a301c3d8.jpg"
                alt="Александр Шматков — создатель и дизайнер SKY RIFT"
              />
            </div>
            <h2 className="drawer-title">
              Приветствую, меня зовут Александр Шматков. Я создатель и дизайнер SKY RIFT.
            </h2>
            <p className="drawer-lead">
              SKY RIFT объединяет эстетику природных ландшафтов, тактильный дизайн и чистую
              инженерию. Мы создаём живые образы, цифровые пространства и бренды с характером и
              глубиной.
            </p>
            <div className="drawer-principles">
              <div className="drawer-principle">
                <h3>01. Корни и контекст</h3>
                <p>
                  Каждый проект начинается с глубокого понимания среды, людей и истории, в которой
                  будет жить бренд.
                </p>
              </div>
              <div className="drawer-principle">
                <h3>02. Бережная инженерия</h3>
                <p>
                  Точность деталей, высокая производительность и чистота формы без визуальной
                  избыточности.
                </p>
              </div>
              <div className="drawer-principle">
                <h3>03. Долгое развитие</h3>
                <p>
                  Мы проектируем выразительные системы, которые остаются актуальными и раскрываются
                  со временем.
                </p>
              </div>
            </div>
          </div>
        )}

        {section === 'journal' && (
          <div className="drawer-body">
            <h2 className="drawer-title">
              SKY RIFT — это не просто название, а точка входа в другое измерение жизни.
            </h2>
            <p className="drawer-lead">
              «Небесный разлом» символизирует момент, когда привычный серый потолок рутины
              расступается, впуская свежий воздух, высоту, неизведанные горизонты и энергию самой
              жизни.
            </p>
            <p className="drawer-lead">
              Мы создаем идеологию для тех, кто верит: настоящее долголетие измеряется не
              количеством прожитых лет, а глубиной впечатлений, подвижностью тела и ясностью ума,
              которые рождаются в пути.
            </p>
            <div className="drawer-principles">
              <div className="drawer-principle">
                <h3>01. Движение как код молодости.</h3>
                <p>
                  Новые маршруты, смена климата и ландшафтов, физическая активность на природе
                  перезапускают нервную систему, тренируют адаптивность организма и удерживают ум в
                  состоянии живого любопытства — одного из главных факторов долголетия.
                </p>
              </div>
              <div className="drawer-principle">
                <h3>02. Путешествие без суеты и галочки.</h3>
                <p>
                  Для нас дорога — это не список достопримечательностей для фото, а пространство
                  восстановления, тишины, силы и контакта с собой.
                </p>
              </div>
              <div className="drawer-principle">
                <h3>03. Горизонт важнее расписания.</h3>
                <p>
                  Мы ценим ритм дыхания, солнечный свет, высоту и свободу выбора больше, чем жесткие
                  рамки.
                </p>
              </div>
            </div>
          </div>
        )}

        {section === 'contact' && (
          <div className="drawer-body">
            <h2 className="drawer-title">Давайте вырастим что-то новое.</h2>
            <p className="drawer-lead">
              Расскажите о вашем проекте в сфере экологии, науки, архитектуры или устойчивых
              технологий. Ответим в течение двух рабочих дней.
            </p>

            {submitted ? (
              <div className="drawer-success">
                <Check size={20} strokeWidth={1.8} />
                <div>
                  <h3>Сообщение получено</h3>
                  <p>
                    Спасибо, {name}. Команда Fernhollow уже изучает ваш запрос и скоро свяжется по
                    адресу {email}.
                  </p>
                </div>
              </div>
            ) : (
              <form className="drawer-form" onSubmit={handleSubmit}>
                <label className="drawer-field">
                  <span>Имя</span>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Как к вам обращаться"
                  />
                </label>
                <label className="drawer-field">
                  <span>Электронная почта</span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@studio.org"
                  />
                </label>
                <label className="drawer-field">
                  <span>О задаче</span>
                  <textarea
                    rows={4}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Кратко опишите идею, сроки и цели"
                  />
                </label>
                <button type="submit" className="drawer-submit">
                  Отправить письмо
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
