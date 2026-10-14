"""Browser regression tests using fictional data; no Supabase traffic or writes.

Run: python3 -B -m unittest discover -s tests -v
Requires Python Playwright and /usr/bin/chromium.
"""
import functools
import http.server
import threading
import unittest
from pathlib import Path

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
SDK_STUB = """
window.supabase = {createClient: () => ({auth: {
  getSession: async () => ({data: {session: null}}),
  onAuthStateChange: () => ({data: {subscription: {unsubscribe() {}}}})
}})};
"""
FIXTURE = """() => {
  window.testPlayers = [
    {id: 'brother', name: '佐々木 太郎', category_id: 'category', categories: {name: '小学3年生'}},
    {id: 'younger', name: '佐々木 次郎', category_id: 'category', categories: {name: '小学1年生'}}
  ];
  window.testEvents = [{id: 'practice', club_id: 'test-club', event_date: '2026-10-15',
    title: '架空の練習', event_type: '練習', place: '架空グラウンド'}];
  window.testResponses = [{event_id: 'practice', player_id: 'brother', status: '出席', reason: ''}];
  window.testWrites = [];
  window.saveMode = 'success';
  window.delayVenueRead = false;
  window.venueResolvers = [];
  window.completedLoads = 0;
  const originalLoad = load;
  load = async () => {await originalLoad(); completedLoads++;};
  sb.from = table => {
    const result = {data: table === 'players' ? testPlayers : table === 'events' ? testEvents :
      table === 'attendance_responses' ? testResponses : [], error: null};
    const chain = new Proxy({}, {get: (_, key) => {
      if (key === 'then') return (resolve, reject) => {
        if (table === 'venues' && delayVenueRead) {
          return new Promise(done => venueResolvers.push(() => done(result))).then(resolve, reject);
        }
        return Promise.resolve(result).then(resolve, reject);
      };
      if (key === 'upsert') return async row => {
        testWrites.push({...row});
        if (saveMode === 'pending') await new Promise(resolve => {window.finishSave = resolve;});
        if (saveMode === 'throw') throw new Error('simulated network exception');
        if (saveMode === 'error') return {error: {message: 'simulated rejection'}};
        const index = testResponses.findIndex(r => r.event_id === row.event_id && r.player_id === row.player_id);
        if (index < 0) testResponses.push({...row}); else testResponses[index] = {...row};
        return {error: null};
      };
      return () => chain;
    }});
    return chain;
  };
  user = {id: 'fictional-parent'};
  club = {id: 'test-club', name: '架空クラブ', sport: 'サッカー'};
  appRole = 'guardian'; cursor = new Date(2026, 9, 1);
  playerRows = testPlayers; events = testEvents; responses = testResponses;
  $('auth').classList.add('hidden'); $('app').classList.remove('hidden'); applyRoleUI();
}"""


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


class AttendanceSafetyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        handler = functools.partial(QuietHandler, directory=str(ROOT))
        cls.server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.playwright = sync_playwright().start()
        cls.browser = cls.playwright.chromium.launch(executable_path='/usr/bin/chromium')

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def setUp(self):
        self.context = self.browser.new_context(viewport={'width': 375, 'height': 812})
        self.page = self.context.new_page()
        self.page.set_default_timeout(3000)
        self.page.on('dialog', lambda dialog: dialog.dismiss())
        # Only local HTTP is allowed. External SDK is replaced with an auth stub;
        # all data operations below use an in-memory fake with fictional IDs.
        def route(request_route):
            url = request_route.request.url
            if url.startswith('http://127.0.0.1:'):
                request_route.continue_()
            elif '@supabase/supabase-js' in url:
                request_route.fulfill(content_type='application/javascript', body=SDK_STUB)
            elif 'qrcodejs' in url:
                request_route.fulfill(content_type='application/javascript', body='')
            else:
                request_route.abort()
        self.context.route('**/*', route)
        self.page.goto(f'http://127.0.0.1:{self.server.server_port}/', wait_until='load')
        self.page.evaluate(FIXTURE)
        self.page.evaluate("async () => {await players(); render('2026-10-15');}")

    def tearDown(self):
        self.context.close()

    def select(self, player):
        self.page.select_option('#childPicker', player)

    def assert_target(self, player):
        self.assertEqual(self.page.locator('#childPicker').input_value(), player)
        self.assertEqual(self.page.locator('#replyPlayer').input_value(), player)
        self.assertEqual(self.page.locator('.reply').get_attribute('data-player'), player)

    def test_a_b_c_switch_and_save_correct_sibling(self):
        self.select('younger')
        self.assert_target('younger')
        self.page.locator('.status[data-status="欠席"]').click()
        self.page.wait_for_function('testWrites.length === 1 && !document.querySelector(".reply").dataset.saving')
        self.assertEqual(self.page.evaluate('testWrites[0].player_id'), 'younger')
        self.select('brother')
        self.assert_target('brother')
        self.page.locator('.status[data-status="早退"]').click()
        self.page.wait_for_function('testWrites.length === 2 && !document.querySelector(".reply").dataset.saving')
        self.assertEqual(self.page.evaluate('testWrites[1].player_id'), 'brother')

    def test_d_refresh_preserves_selected_player_and_day(self):
        self.select('younger')
        self.page.evaluate('load()')
        self.assert_target('younger')
        self.assertEqual(self.page.locator('.day.selected').get_attribute('data-date'), '2026-10-15')

    def test_e_failed_and_thrown_saves_keep_previous_answer(self):
        for mode in ['error', 'throw']:
            with self.subTest(mode=mode):
                self.page.evaluate(f"saveMode = '{mode}'")
                self.page.locator('.status[data-status="欠席"]').click()
                self.page.wait_for_function('!document.querySelector(".reply").dataset.saving')
                self.assertEqual(self.page.locator('.status.chosen').get_attribute('data-status'), '出席')
                self.assertIn('保存できていません。もう一度お試しください', self.page.locator('.reply').inner_text())
                self.assertEqual(self.page.evaluate('testResponses[0].status'), '出席')
                self.assertTrue(self.page.locator('.status[data-status="欠席"]').is_enabled())

    def test_f_pending_save_blocks_duplicates_even_after_redraw(self):
        self.page.evaluate("saveMode = 'pending'")
        self.page.locator('.status[data-status="欠席"]').click()
        self.assertEqual(self.page.locator('.status.chosen').get_attribute('data-status'), '出席')
        self.assertEqual(self.page.locator('.reply button:disabled').count(), 5)
        self.assertTrue(self.page.locator('.reply .reason').is_disabled())
        self.page.evaluate('''() => {
          document.querySelector('.status[data-status="欠席"]').onclick();
          document.querySelector('.status[data-status="遅刻"]').onclick();
          render('2026-10-15');
          document.querySelector('.status[data-status="早退"]').onclick();
        }''')
        self.assertEqual(self.page.evaluate('testWrites.length'), 1)
        self.page.evaluate('finishSave()')
        self.page.wait_for_function('document.querySelector(".status.chosen").dataset.status === "欠席"')

    def test_switch_during_pending_save_does_not_restore_old_player(self):
        self.page.evaluate("saveMode = 'pending'")
        self.page.locator('.status[data-status="欠席"]').click()
        self.select('younger')
        self.assert_target('younger')
        self.page.evaluate('finishSave()')
        self.page.wait_for_function('testResponses[0].status === "欠席"')
        self.page.evaluate('load()')
        self.assert_target('younger')

    def test_switch_back_to_pending_player_keeps_lock(self):
        self.page.evaluate("saveMode = 'pending'")
        self.page.locator('.status[data-status="欠席"]').click()
        self.select('younger')
        self.assertTrue(self.page.locator('.status[data-status="欠席"]').is_enabled())
        self.select('brother')
        self.assertEqual(self.page.locator('.reply button:disabled').count(), 5)
        self.page.evaluate('document.querySelector(".status[data-status=遅刻]").onclick()')
        self.assertEqual(self.page.evaluate('testWrites.length'), 1)
        self.page.evaluate('finishSave()')
        self.page.wait_for_function('!document.querySelector(".reply").dataset.saving')
        self.assert_target('brother')

    def test_legacy_player_selector_stays_in_sync(self):
        self.page.evaluate("() => {$('replyPlayer').value='younger';$('replyPlayer').onchange();}")
        self.assert_target('younger')

    def test_ineligible_player_and_month_change_remove_old_controls(self):
        self.page.evaluate("() => {teamGroups=[{id:'group',name:'架空チーム'}];eventTeamLinks=[{event_id:'practice',team_group_id:'group'}];playerTeamLinks=[{player_id:'brother',team_group_id:'group'}];}")
        self.select('younger')
        self.assertEqual(self.page.locator('.reply').count(), 0)
        self.select('brother')
        self.assert_target('brother')
        self.page.locator('#next').click()
        self.assertEqual(self.page.locator('.reply').count(), 0)

    def test_stale_detached_reply_cannot_submit(self):
        self.page.evaluate('window.oldButton = document.querySelector(".status[data-status=欠席]")')
        self.select('younger')
        self.page.evaluate('oldButton.onclick()')
        self.assertEqual(self.page.evaluate('testWrites.length'), 0)

    def test_g_name_and_buttons_on_mobile_widths(self):
        for width in [320, 375, 390, 430]:
            with self.subTest(width=width):
                self.page.set_viewport_size({'width': width, 'height': 812})
                self.select('younger')
                self.assert_target('younger')
                self.assertIn('佐々木 次郎さんの回答', self.page.locator('.reply').inner_text())
                self.assertEqual(self.page.locator('.reply .status').count(), 5)
                self.assertTrue(self.page.locator('.reply').evaluate('''e => {
                  const name=e.querySelector('.replyPlayerName').getBoundingClientRect();
                  return [...e.querySelectorAll('.status')].every(button => {
                    const r=button.getBoundingClientRect();
                    return r.width>0 && r.height>0 && r.left>=0 && r.right<=innerWidth && name.bottom<=r.top;
                  });
                }'''))
                self.assertTrue(self.page.locator('.reply').evaluate('''e => {
                  const r=e.getBoundingClientRect(); return r.left>=0 && r.right<=innerWidth;
                }'''))
                self.assertTrue(self.page.locator('.replyPlayerName').evaluate('e => e.scrollWidth <= e.clientWidth'))

    def test_new_a_to_e_other_sibling_draft_survives_save_and_refresh(self):
        self.page.evaluate("saveMode='pending'; delayVenueRead=true")
        self.page.locator('.status[data-status="欠席"]').click()
        self.select('younger')
        draft = '弟の未保存の連絡事項\n迎えは少し遅れます。'
        self.page.locator('.reply .reason').fill(draft)
        self.page.evaluate('finishSave()')
        self.page.wait_for_function('venueResolvers.length===1')
        self.assert_target('younger')
        self.assertEqual(self.page.locator('.reply .reason').input_value(), draft)
        self.page.evaluate('venueResolvers.shift()()')
        # Wait for the entire first save callback, including its refresh, to settle.
        self.page.wait_for_function('completedLoads===1')
        self.assertEqual(self.page.locator('.reply .reason').input_value(), draft)
        self.page.evaluate("saveMode='success'; delayVenueRead=false")
        self.page.locator('.status[data-status="遅刻"]').click()
        self.page.wait_for_function('testWrites.length===2 && !document.querySelector(".reply").dataset.saving')
        self.assertEqual(self.page.evaluate('testWrites[1].player_id'), 'younger')
        self.assertEqual(self.page.evaluate('testWrites[1].reason'), draft)
        self.assertEqual(self.page.evaluate('testResponses.find(r=>r.player_id==="younger").reason'), draft)

    def test_new_f_missing_selection_stays_unselected_across_refreshes(self):
        self.select('younger')
        self.page.evaluate("testPlayers=testPlayers.filter(p=>p.id!=='younger')")
        for _ in range(3):
            self.page.evaluate('load()')
            self.assertEqual(self.page.locator('#childPicker').input_value(), '')
            self.assertEqual(self.page.locator('#replyPlayer').input_value(), '')
            self.assertEqual(self.page.locator('.reply').count(), 0)
        self.assertEqual(self.page.evaluate('testWrites.length'), 0)
        self.select('brother')
        self.assert_target('brother')

    def test_new_g_unlocks_on_write_success_before_unrelated_refresh(self):
        self.page.evaluate('delayVenueRead=true')
        self.page.locator('.status[data-status="欠席"]').click()
        self.page.wait_for_function('venueResolvers.length===1')
        self.assertEqual(self.page.locator('.status.chosen').get_attribute('data-status'), '欠席')
        self.assertEqual(self.page.locator('.reply button:disabled').count(), 0)
        self.assertTrue(self.page.locator('.reply .reason').is_enabled())
        self.assertNotIn('保存中', self.page.locator('.reply').inner_text())
        self.page.evaluate('venueResolvers.shift()()')

    def test_new_draft_survives_switches_empty_input_and_failed_retry(self):
        self.page.locator('.reply .reason').fill('兄の未保存の連絡')
        self.select('younger')
        self.page.locator('.reply .reason').fill('弟の未保存の連絡')
        self.page.evaluate("render('2026-10-15')")
        self.assertEqual(self.page.locator('.reply .reason').input_value(), '弟の未保存の連絡')
        self.select('brother')
        self.assertEqual(self.page.locator('.reply .reason').input_value(), '兄の未保存の連絡')
        self.page.locator('.reply .reason').fill('')
        self.page.evaluate('load()')
        self.assertEqual(self.page.locator('.reply .reason').input_value(), '')
        self.select('younger')
        self.page.evaluate("saveMode='error'")
        self.page.locator('.status[data-status="欠席"]').click()
        self.page.wait_for_function('!document.querySelector(".reply").dataset.saving')
        self.page.evaluate('load()')
        self.assertEqual(self.page.locator('.reply .reason').input_value(), '弟の未保存の連絡')

    def test_new_old_refresh_does_not_unlock_a_new_save(self):
        self.page.evaluate('delayVenueRead=true')
        self.page.locator('.status[data-status="欠席"]').click()
        self.page.wait_for_function('venueResolvers.length===1')
        self.page.locator('.reply .reason').fill('次の回答の未保存の連絡')
        self.page.evaluate("saveMode='pending'")
        self.page.locator('.status[data-status="遅刻"]').click()
        self.page.wait_for_function('testWrites.length===2')
        self.page.evaluate('venueResolvers.shift()()')
        self.page.wait_for_function('completedLoads===1')
        self.assertEqual(self.page.locator('.reply button:disabled').count(), 5)
        self.assertEqual(self.page.locator('.reply .reason').input_value(), '次の回答の未保存の連絡')
        self.page.evaluate('delayVenueRead=false; finishSave()')
        self.page.wait_for_function('!document.querySelector(".reply").dataset.saving')


if __name__ == '__main__':
    unittest.main()
