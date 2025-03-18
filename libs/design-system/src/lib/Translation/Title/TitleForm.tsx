import { Input } from '../../Input/Input';
import { Label } from '../../Label/Label';
import { LANGUAGES, Title, Titles } from '@data-access';

export const TitleForm = ({
  titles = [],
  onChange,
}: {
  titles?: Titles;
  onChange: (title: Title) => void;
}) => {
  const titlesByLanguage: { [key: string]: Title } = {};
  titles.forEach((title) => {
    titlesByLanguage[title.language] = title;
  });

  return (
    <div className="flex flex-col gap-4">
      {LANGUAGES.map((language) => (
        <div key={language} className="flex flex-col gap-2">
          <Label className="uppercase">{language}</Label>
          <Input
            type="text"
            placeholder={`Enter ${language} title`}
            value={titlesByLanguage[language]?.title}
            onChange={(e) =>
              onChange({
                ...titlesByLanguage[language],
                title: e.target.value,
                language,
              })
            }
          />
        </div>
      ))}
    </div>
  );
};
