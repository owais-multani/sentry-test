import {mountWithTheme} from 'sentry-test/enzyme';

import ConfigStore from 'sentry/stores/configStore';
import OrganizationCreate from 'sentry/views/organizationCreate';

describe('OrganizationCreate', function () {
  let privacyUrl, termsUrl;

  beforeEach(() => {
    termsUrl = ConfigStore.get('termsUrl', null);
    privacyUrl = ConfigStore.get('privacyUrl', null);
  });

  afterEach(() => {
    ConfigStore.set('termsUrl', termsUrl);
    ConfigStore.set('privacyUrl', privacyUrl);
  });

  describe('render()', function () {
    it('renders without terms', function () {
      ConfigStore.set('termsUrl', null);
      ConfigStore.set('privacyUrl', null);
      const wrapper = mountWithTheme(<OrganizationCreate />, {
        context: {router: TestStubs.router()},
      });
      expect(wrapper).toSnapshot();
    });

    it('renders with terms', function () {
      ConfigStore.set('termsUrl', 'https://example.com/terms');
      ConfigStore.set('privacyUrl', 'https://example.com/privacy');
      const wrapper = mountWithTheme(<OrganizationCreate />, {
        context: {router: TestStubs.router()},
      });
      expect(wrapper).toSnapshot();
    });
  });
});
