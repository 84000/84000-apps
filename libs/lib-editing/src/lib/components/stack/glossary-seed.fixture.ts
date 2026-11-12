/**
 * Glossary definitions as the seed data stores them (infra/supabase/seed:
 * toh251, toh145 and toh90001 glossaries), picked to cover every markup shape
 * the seeds hold: plain paragraphs, several paragraphs, foreign-language spans,
 * titles, emphasis, glossary cross-links, passage pointers, soft hyphens and
 * trailing spaces. Strings are verbatim.
 */
export const GLOSSARY_SEED_DEFINITIONS: readonly (readonly [string, string])[] =
  [
    [
      'plain',
      '<p class="definition">Refers to the fourfold practice of love, compassion, joy, and impartiality.</p>',
    ],
    [
      'glossary-id',
      '<p class="definition">Also rendered here as “<span data-glossary-id="UT22084-057-004-1159">Mañjuśrī</span>.”</p>',
    ],
    [
      'glossary-id',
      '<p class="definition">A term for realized beings in Buddhism. Also translated here as “<span data-glossary-id="UT22084-057-004-913">ārya</span>.”</p>',
    ],
    [
      'pointer',
      '<p class="definition">See <a href="/entity/passage/5db608d7-2b91-447d-abb7-785dce7868b6" data-pointer-type="id">n.112</a>.</p>',
    ],
    [
      'pointer',
      '<p class="definition">Refers to a <span data-glossary-id="UT22084-057-004-1045">pratyekabuddha</span>. See <a href="/entity/passage/023783dd-5cc4-4648-ab1e-f8c5a70c1482" data-pointer-type="id">n.109</a>.</p>',
    ],
    [
      'cite',
      '<p class="definition">In the Tibetan translation of the <cite class="title break text-sa" lang="sa-LATN">Avataṃsaka</cite>, this same term is rendered <span class="foreign text-wy" lang="bo-LATN">byang chub sems dpa’ rnam par dgod pa bcu</span>.</p>',
    ],
    [
      'cite',
      '<p class="definition">A major śrāvaka disciple and personal attendant of the Buddha Śākyamuni during the last twenty-five years of his life. He was a cousin of the Buddha (according to the <cite class="title break text-sa" lang="sa-LATN">Mahāvastu</cite>, he was a son of Śuklodana, one of the brothers of King Śuddhodana, which means he was a brother of Devadatta; other sources say he was a son of Amṛtodana, another brother of King Śuddhodana, which means he would have been a brother of Aniruddha).</p><p class="definition">Ānanda, having always been in the Buddha’s presence, is said to have memorized all the teachings he heard and is celebrated for having recited all the Buddha’s teachings by memory at the first council of the Buddhist saṅgha, thus preserving the teachings after the Buddha’s parinirvāṇa. The phrase “Thus did I hear at one time,” found at the beginning of the sūtras, usually stands for his recitation of the teachings. He became a patriarch after the passing of Mahākāśyapa.</p>',
    ],
    [
      'em-class',
      '<p class="definition">Indian beech tree (<em class="foreign">pongamia glabra</em>); used medicinally. </p>',
    ],
    [
      'em-class',
      '<p class="definition">The name of the southern continent in Buddhist cosmology, which can signify either the known human world, or more specifically the Indian subcontinent, literally “the <span class="foreign break text-sa" lang="sa-LATN">jambu</span> island/continent.” Jambu is the name used for a range of plum-like fruits from trees belonging to the genus <em class="foreign">Szygium</em>, particularly <em class="foreign">Szygium jambos</em> and <em class="foreign">Szygium cumini</em>, and it has commonly been rendered “rose apple,” although “black plum” may be a less misleading term. Among various explanations given for the continent being so named, one (in the <cite class="title break text-sa" lang="sa-LATN">Abhidharmakośa</cite>) is that a jambu tree grows in its northern mountains beside Lake Anavatapta, mythically considered the source of the four great rivers of India, and that the continent is therefore named from the tree or the fruit. Jambudvīpa has the Vajrāsana at its center and is the only continent upon which buddhas attain awakening.</p>',
    ],
    [
      'foreign-span',
      '<p class="definition">A term meaning acceptance, forbearance, or patience. As the third of the six perfections, patience is classified into three kinds: the capacity to tolerate abuse from sentient beings, to tolerate the hardships of the path to buddhahood, and to tolerate the profound nature of reality. As a term referring to a bodhisattva’s realization, <span class="foreign break text-sa" lang="sa-LATN">dharmakṣānti</span> (<span class="foreign text-wy" lang="bo-LATN">chos la bzod pa</span>) can refer to the ways one becomes “receptive” to the nature of Dharma, and it can be an abbreviation of <span class="foreign break text-sa" lang="sa-LATN">anutpattikadharmakṣānti</span>, “forbearance for the unborn nature, or nonproduction, of dharmas.”</p>',
    ],
    [
      'multi-p',
      '<p class="definition">In the context of Buddhist philosophy, one way to describe experience in terms of eighteen elements (eye, form, and eye consciousness; ear, sound, and ear consciousness; nose, smell, and nose consciousness; tongue, taste, and tongue consciousness; body, touch, and body consciousness; and mind, mental phenomena, and mind consciousness).</p><p class="definition">This also refers to the elements of the world, which can be enumerated as four, five, or six. The four elements are earth, water, fire, and air. A fifth, space, is often added, and the sixth is consciousness.</p>',
    ],
    [
      'soft-hyphen',
      '<p>Burchardi, Anne, trans. <em><a href="https://read.84000.co/translation/toh147.html">The Teaching on the Great Compassion of the Tathāgata</a></em> (Toh 147, <em>Tathāgata­mahā­karuṇā­nirdeśa­sūtra</em>). 84000: Translating the Words of the Buddha, 2020.</p>',
    ],
    [
      'soft-hyphen',
      '<p class="definition">One of the principal śrāvaka disciples of the Buddha, he was renowned for his discipline and for having been praised by the Buddha as foremost of the wise (often paired with Maudgalyā­yana, who was praised as foremost in the capacity for miraculous powers). His father, Tiṣya, to honor Śāriputra’s mother, Śārikā, named him Śāradvatīputra, or, in its contracted form, Śāriputra, meaning “Śārikā’s Son.”</p>',
    ],
    [
      'trailing-space',
      '<p>Monier-Williams, Monier. <em>A Sanskrit-English Dictionary</em>. Oxford: Clarendon Press, 1899. </p>',
    ],
    [
      'trailing-space',
      '<p class="definition">The highest of all the form realm (<span class="foreign break text-sa" lang="sa-LATN">rūpadhātu</span>) worlds. The world of devas “equal in rank” (literally “having no one as the youngest”). </p>',
    ],
    [
      'curly-quotes',
      '<p class="definition">Also translated here as “<span><span data-glossary-id="UT22084-057-004-1054">same</span></span>” in the context of the <span data-glossary-id="UT22084-057-004-1069">ten continuities of Dharma</span>. </p>',
    ],
    [
      'longest',
      '<p class="definition">One of the first Buddhist monasteries, located in a park outside Śrāvastī, the capital of the ancient kingdom of Kośala in northern India. This park was originally owned by Prince Jeta, hence the name Jetavana, meaning Jeta’s grove. The wealthy merchant Anāthapiṇḍada, wishing to offer it to the Buddha, sought to buy it from him, but the prince, not wishing to sell, said he would only do so if Anāthapiṇḍada covered the entire property with gold coins. Anāthapiṇḍada agreed, and managed to cover all of the park except the entrance, hence the name Anāthapiṇḍadasyārāmaḥ, meaning Anāthapiṇḍada’s park. The place is usually referred to in the sūtras as “Jetavana, Anāthapiṇḍada’s park,” and according to the <cite class="title break text-sa" lang="sa-LATN">Saṃghabhedavastu </cite> the Buddha used Prince Jeta’s name in first place because that was Prince Jeta’s own unspoken wish while Anāthapiṇḍada was offering the park. Inspired by the occasion and the Buddha’s use of his name, Prince Jeta then offered the rest of the property and had an entrance gate built. The Buddha specifically instructed those who recite the sūtras to use Prince Jeta’s name in first place to commemorate the mutual effort of both benefactors. </p><p class="definition">Anāthapiṇḍada built residences for the monks, to house them during the monsoon season, thus creating the first Buddhist monastery. It was one of the Buddha’s main residences, where he spent around nineteen rainy season retreats, and it was therefore the setting for many of the Buddha’s discourses and events. According to the travel accounts of Chinese monks, it was still in use as a Buddhist monastery in the early fifth century <span class="small-caps">ᴄᴇ</span>, but by the sixth century it had been reduced to ruins. </p>',
    ],
  ];
