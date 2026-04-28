import './Carousel.css';

const TOP_50 = new Set([
  'in','cn','us','id','pk','br','ng','bd','ru','et',
  'mx','eg','cd','ph','tz','ir','tr','th','gb','fr',
  'ke','za','kr','co','es','de','vn','sd','mm','dz',
  'ar','pl','iq','ma','sa','af','pe','my','uz','gh',
  'ye','ve','ao','mz','ug','cm','np','au','it','tw',
]);

const flagModules = import.meta.glob('../assets/flags/*.svg', { query: '?url', import: 'default', eager: true });
const flags = Object.entries(flagModules)
  .filter(([path]) => TOP_50.has(path.split('/').pop().replace('.svg', '')))
  .map(([path, url]) => ({
    url,
    code: path.split('/').pop().replace('.svg', '').toUpperCase(),
  }));

export default function Carousel() {
  return (
    <div className="logos">
      {[1, 2].map((i) => (
        <div key={i} className="logos-slide">
          {flags.map((flag) => (
            <img key={flag.code} src={flag.url} alt={flag.code} />
          ))}
        </div>
      ))}
    </div>
  );
}
