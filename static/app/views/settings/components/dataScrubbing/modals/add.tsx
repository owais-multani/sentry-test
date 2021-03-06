import {t} from 'sentry/locale';

import {ProjectId, Rule} from '../types';

import ModalManager from './modalManager';

type ModalManagerProps<T extends ProjectId> = ModalManager<T>['props'];
type Props<T extends ProjectId> = Omit<
  ModalManagerProps<T>,
  'title' | 'initialValues' | 'onGetNewRules'
>;

const Add = <T extends ProjectId = undefined>({savedRules, ...props}: Props<T>) => {
  const handleGetNewRules = (
    values: Parameters<ModalManagerProps<T>['onGetNewRules']>[0]
  ) => {
    return [...savedRules, {...values, id: savedRules.length}] as Array<Rule>;
  };

  return (
    <ModalManager
      {...props}
      savedRules={savedRules}
      title={t('Add an advanced data scrubbing rule')}
      onGetNewRules={handleGetNewRules}
    />
  );
};

export default Add;
