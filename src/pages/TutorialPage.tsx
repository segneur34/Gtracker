import { useEffect } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { t } from '../core/i18n';
import LessonIcon from '../components/LessonIcon';
import Card from '../components/ui/Card';
import PageHeader from '../components/ui/PageHeader';
import { useTutorials } from '../hooks/useTutorials';
import { LESSONS } from '../tutorials/lessons';
import '../components/Tutorials.css';

/**
 * Une leçon des tutoriels (`/tutoriels/:id`) : titre, quelques
 * paragraphes, « Essayer » vers la page dont elle parle, la précédente et la
 * suivante du programme. L'ouvrir la marque lue. Son adresse s'ouvre toujours,
 * même d'une famille cachée ; le retour mène à la liste (`/tutoriels`), d'où
 * qu'on vienne.
 */
function TutorialPage() {
  const { id } = useParams();
  const { lessons, read } = useTutorials();
  const lesson = LESSONS.find((l) => l.id === id) ?? null;
  useEffect(() => {
    if (lesson) read(lesson.id);
  }, [lesson, read]);
  if (!lesson) return <Navigate to="/tutoriels" replace />;

  // Précédente et suivante parmi les leçons montrées ; une leçon d'une famille cachée se place dans le programme entier.
  const order = lessons.some((l) => l.id === lesson.id) ? lessons : LESSONS;
  const at = order.findIndex((l) => l.id === lesson.id);
  const previous = at > 0 ? order[at - 1] : null;
  const next = at >= 0 && at < order.length - 1 ? order[at + 1] : null;

  return (
    <div className="ui-page ui-page--backdrop">
      <PageHeader title={lesson.title} back={{ to: '/tutoriels', label: t('Toutes les leçons') }}
        subtitle={t('Leçon {n} sur {total}', { n: at + 1, total: order.length })} />
      <Card className="tutorial-lesson">
        <div className="tutorial-lesson__head">
          <span className="tutorial-icon" aria-hidden="true"><LessonIcon icon={lesson.icon} size={18} /></span>
          <p className="tutorial-card__hook">{lesson.hook}</p>
        </div>
        {lesson.body.map((text) => <p key={text}>{text}</p>)}
        <Link to={lesson.target} className="ui-btn ui-btn--primary tutorial-lesson__try">{t('Essayer')}</Link>
      </Card>
      <nav className="tutorial-nav" aria-label={t('Leçons')}>
        {previous ? <Link to={`/tutoriels/${previous.id}`} className="ui-btn ui-btn--ghost">{t('Leçon précédente')}</Link> : <span />}
        {next && <Link to={`/tutoriels/${next.id}`} className="ui-btn ui-btn--ghost">{t('Leçon suivante')}</Link>}
      </nav>
    </div>
  );
}

export default TutorialPage;
