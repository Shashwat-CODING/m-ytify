import { navStore, setNavStore, t } from "@stores";
import { setDrawer } from "@utils";

export default function() {

  return (
    <nav>
      <button
        type="button"
        class="nav-btn"
        aria-label={t('nav_home')}
        classList={{
          'on': navStore.active === 'home'
        }}
        onclick={() => {
          setNavStore('active', 'home');
          setDrawer('lastMainFeature', 'home' as any);
        }}
      >
        <svg
          viewBox="0 0 24 24"
          width="24"
          height="24"
          fill="currentColor"
          style={{ display: "inline-block", "vertical-align": "middle" }}
        >
          {navStore.active === 'home' ? (
            <path d="M12 2L2 12H5V20C5 20.5523 5.44772 21 6 21H18C18.5523 21 19 20.5523 19 20V12H22L12 2ZM12 4.69141L17 9.69141V19H7V9.69141L12 4.69141ZM10 12H14V17H10V12Z" />
          ) : (
            <path d="M12 2L2 12H5V20C5 20.5523 5.44772 21 6 21H18C18.5523 21 19 20.5523 19 20V12H22L12 2ZM12 4.69141L17 9.69141V19H14V14H10V19H7V9.69141L12 4.69141Z" fill-rule="evenodd" />
          )}
        </svg>
      </button>

      <i
        aria-label={t('nav_search')}
        class={'ri-search-2-' + (navStore.active === 'search' ? 'fill' : 'line')}
        classList={{
          'on': navStore.active === 'search'
        }}
        onclick={() => {
          setNavStore('active', 'search');
          setDrawer('lastMainFeature', 'search');
        }}
      ></i>

      <i
        aria-label={t('nav_library')}
        class={'ri-archive-stack-' + (navStore.active === 'library' ? 'fill' : 'line')}
        classList={{ 'on': navStore.active === 'library' }}
        onclick={() => {
          setNavStore('active', 'library');
          setDrawer('lastMainFeature', 'library');
        }}
      ></i>
    </nav>
  );
}
