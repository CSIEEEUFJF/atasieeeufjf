export const membershipSource = {
  fileName: "Member Detail View atlz.xlsx",
  filters: ["Region == R9", "Grade == Student Member"],
  includedMembers: 73,
  totalRows: 82,
  validMembers: 77,
};

export const ieeeSocietyMemberships = {
  MEMAES010: { chapter: "AESS", name: "Aerospace and Electronic Systems Society" },
  MEMAP003: { chapter: "APS", name: "Antennas and Propagation Society" },
  MEMBT002: { chapter: "BTS", name: "Broadcast Technology Society" },
  MEMCAS004: { chapter: "CAS", name: "Circuits and Systems Society" },
  MEMC016: { chapter: "CS", name: "Computer Society" },
  MEMCIS011: { chapter: "CIS", name: "Computational Intelligence Society" },
  MEMCOM019: { chapter: "ComSoc", name: "Communications Society" },
  MEME025: { chapter: "EDS", name: "Electron Devices Society" },
  MEMED015: { chapter: "EdSoc", name: "Education Society" },
  MEMEMB018: { chapter: "EMBS", name: "Engineering in Medicine and Biology Society" },
  MEMEP021: { chapter: "EPS", name: "Electronics Packaging Society" },
  MEMIA034: { chapter: "IAS", name: "Industry Applications Society" },
  MEMIE013: { chapter: "IES", name: "Industrial Electronics Society" },
  MEMMTT017: { chapter: "MTTS", name: "Microwave Theory and Technology Society" },
  MEMNPS005: { chapter: "NPSS", name: "Nuclear and Plasma Sciences Society" },
  MEMPE031: { chapter: "PES", name: "Power & Energy Society" },
  MEMRA024: { chapter: "RAS", name: "Robotics and Automation Society" },
  MEMSSC037: { chapter: "SSCS", name: "Solid-State Circuits Society" },
  MEMVT006: { chapter: "VTS", name: "Vehicular Technology Society" },
};

const membershipTsv = `memberNumber	name	email	grade	ieeeStatus	renewYear	section	city	state	societies
96679384	Lucas Galdino	lucas_galdino_r@hotmail.com	Student Member	Active	2026	Minas Gerais Section	Juiz de Fora	Minas Gerais	MEMPE031
98631381	Fabricio Prata Rodrigues	fabriciopratar.10@gmail.com	Student Member	Active	2026	Minas Gerais Section	Juiz de Fora	Minas Gerais	MEMC016;MEMCOM019;MEME025;MEMED015;MEMEP021;MEMIA034;MEMPE031;MEMRA024;MEMVT006
99381272	Camila Porto Belli Castanha	camila.belli@ieee.org	Student Member	Active	2026	Minas Gerais Section	Juiz de Fora	Minas Gerais	MEMBT002;MEMC016;MEME025;MEMED015;MEMEMB018;MEMEP021;MEMIA034;MEMIE013;MEMPE031
99386404	Olivio Inacio De Abreu Junior	olivio.inacio@estudante.ufjf.br	Student Member	Active	2026	Minas Gerais Section	JUIZ DE FORA	Minas Gerais	MEMC016;MEMCOM019;MEME025;MEMED015;MEMEP021;MEMIA034;MEMPE031;MEMVT006
99564572	Luiz Felipe Alves Maciel	maciel.felipe@estudante.ufjf.br	Student Member	Active	2026	Minas Gerais Section	Juiz de Fora	Minas Gerais	
99727745	Pedro de Oliveira Fuzimoto	pedro.fuzimoto03@gmail.com	Student Member	Active	2026	Minas Gerais Section	juiz de fora	Minas Gerais	MEMAP003;MEMC016;MEMCOM019;MEME025;MEMEP021;MEMIA034;MEMMTT017;MEMPE031;MEMRA024;MEMVT006
99886306	Pedro Temponi Santana	temponi.pedro18@gmail.com	Student Member	Active	2026	Minas Gerais Section	Juiz de Fora	Minas Gerais	MEMAP003;MEMC016;MEMCOM019;MEME025;MEMED015;MEMEP021;MEMIA034;MEMPE031;MEMVT006
100195811	Raul Moraes Neves	raulmoraes430@gmail.com	Student Member	Active	2026	Minas Gerais Section	Juiz de Fora	Minas Gerais	MEMC016;MEMCOM019;MEME025;MEMED015;MEMEP021;MEMIA034;MEMPE031;MEMRA024;MEMVT006
100242154	Lauro Abdallah Ritti de Oliveira	lauro.abdallah@estudante.ufjf.br	Student Member	Active	2026	Minas Gerais Section	Juiz de Fora	Minas Gerais	MEMC016;MEMCOM019;MEME025;MEMED015;MEMEP021;MEMIA034;MEMPE031;MEMVT006
100244151	ROBERTA LUCHINI LEONARDO	robertaleonardo26@gmail.com	Student Member	Active	2026	Minas Gerais Section	Juiz de Fora		MEMC016;MEMCOM019;MEME025;MEMED015;MEMEP021;MEMIA034;MEMPE031;MEMVT006
100255254	IURY EGIDIO DE ALMEIDA FERREIRA	iury.ferreira@estudante.ufjf.br	Student Member	Active	2026	Minas Gerais Section	Juiz de Fora		MEMC016;MEMCOM019;MEME025;MEMED015;MEMEP021;MEMIA034;MEMPE031;MEMRA024;MEMVT006
100384692	Igor Santos Oliveira	igor.oliveira2022@engenharia.ufjf.br	Student Member	Active	2026	Minas Gerais Section	juiz de fora	Minas Gerais	MEMC016;MEMCOM019;MEME025;MEMED015;MEMEP021;MEMIA034;MEMPE031;MEMRA024;MEMVT006
100615941	Breno Lamha	breno.lamha@ieee.com	Student Member	Active	2026	Minas Gerais Section	Juiz de FOra	Minas Gerais	MEMC016;MEMCOM019;MEME025;MEMED015;MEMEP021;MEMIA034;MEMPE031;MEMRA024;MEMVT006
100654472	Rafael Moreira	rafamuller05+ieee@gmail.com	Student Member	Active	2026	Minas Gerais Section	Juiz de Fora	Minas Gerais	MEMAES010;MEMC016
100991400	Leonela Medeiros de Souza Faria	leonelafaria05@gmail.com	Student Member	Active	2026	Minas Gerais Section	Juiz de Fora	Minas Gerais	MEMC016;MEMCOM019;MEME025;MEMED015;MEMEP021;MEMIA034;MEMPE031;MEMRA024;MEMVT006
101026261	Endhel Andrade Jesus	endheldejesus12@gmail.com	Student Member	Active	2026	Minas Gerais Section	JUIZ DE FORA	Minas Gerais	MEMC016;MEMCAS004;MEMCOM019;MEME025;MEMED015;MEMEP021;MEMIA034;MEMIE013;MEMPE031;MEMRA024;MEMVT006
101461620	Brendo L. V. Almeida	brendolee2004@outlook.com	Student Member	Active	2026	Minas Gerais Section	Juiz de fora	Minas Gerais	MEMAES010;MEMAP003;MEMC016;MEMCAS004;MEME025;MEMRA024
101890861	Rafael Lago Nick	rafael.nick@computer.org	Student Member	Active	2026	Minas Gerais Section	Juiz de Fora	Minas Gerais	MEMAES010;MEMAP003;MEMC016;MEMCAS004;MEMCIS011;MEMCOM019;MEME025;MEMEP021;MEMIA034;MEMIE013;MEMMTT017;MEMPE031;MEMRA024;MEMSSC037
101894131	Nicolas Augusto Avila	nicolasavila802@gmail.com	Student Member	Active	2026	Minas Gerais Section	juiz de fora	Minas Gerais	MEMAP003;MEMC016;MEMPE031
101899709	Rafael Ferreira Campos	2001campos.rafael@gmail.com	Student Member	Active	2026	Minas Gerais Section	Juiz de Fora		MEMC016;MEMCOM019;MEME025;MEMIA034
101899897	Eduardo Motta Zilli	edumzilli@gmail.com	Student Member	Active	2026	Minas Gerais Section	Juiz de Fora	Minas Gerais	MEMC016;MEMCAS004;MEMIA034;MEMPE031;MEMRA024
101906415	Joao Paulo Nazareth da Silva	joaonazareth.pessoal@gmail.com	Student Member	Active	2026	Minas Gerais Section	Juiz de Fora	Minas Gerais	MEMIA034;MEMPE031
101908482	Kevin Goncalves Correa Alves	kevinalves105@gmail.com	Student Member	Active	2026	Minas Gerais Section	Coronel Pacheco	Minas Gerais	MEMRA024
101909484	Thalita Mello Silva	thalita.mello@estudante.ufjf.br	Student Member	Active	2026	Minas Gerais Section	Juiz de Fora	Minas Gerais	MEMC016;MEMIA034;MEMPE031
101912704	Arthur Araujo Martins	arthuraraujojf@outlook.com	Student Member	Active	2026	Minas Gerais Section	Juiz de Fora	Minas Gerais	MEMC016;MEMCAS004;MEMCOM019;MEME025;MEMNPS005;MEMPE031;MEMRA024
101912842	Mariana Guimaraes Machado	guimaraesmachadomariana@gmail.com	Student Member	Active	2026	Minas Gerais Section	Juiz de Fora	Minas Gerais	MEMC016;MEMCAS004;MEME025;MEMIA034;MEMPE031;MEMRA024
101924715	Matheus Nery Bastos	matheus.nery@estudante.ufjf.br	Student Member	Active	2026	Minas Gerais Section	Juiz de fora	Minas Gerais	MEMVT006
101924732	Vinícius Tarelho Tarelho	vini.tarelho.800@gmail.com	Student Member	Active	2026	Minas Gerais Section	Juiz de Fora	Minas Gerais	MEMAP003;MEMC016;MEMCAS004;MEMCOM019;MEME025;MEMIA034;MEMPE031;MEMRA024
101924735	Yuri Freitas	yuricalixxto2@gmail.com	Student Member	Active	2026	Minas Gerais Section	Juiz De Fora		MEMVT006
101924760	Lucas Valente Guerra	valenteguerralucas@gmail.com	Student Member	Active	2026	Minas Gerais Section	JUIZ DE FORA	Minas Gerais	MEMVT006
101924766	Taleri Torres Moura	taleri.moura@estudante.ufjf.br	Student Member	Active	2026	Minas Gerais Section	Juiz de Fora	Minas Gerais	MEMVT006
101930852	Maria Eduarda Sa Amorim	mariaeduarda.amorim@estudante.ufjf.br	Student Member	Active	2026	Minas Gerais Section	Juiz de Fora	Minas Gerais	MEMAP003;MEMC016;MEMMTT017;MEMRA024
101933873	Vitor de Oliveira Motta	motta.vitor0909@gmail.com	Student Member	Active	2026	Minas Gerais Section	Juiz de Fora	Minas Gerais	MEMVT006
101933920	Mateus Rodrigues Cruz	mateus.cruz@estudante.ufjf.br	Student Member	Active	2026	Minas Gerais Section	juiz de fora	Minas Gerais	MEMVT006
101980960	Caio Faria Rigues	riguescaio@gmail.com	Student Member	Active	2026	Minas Gerais Section	Juiz de Fora	Minas Gerais	MEMAES010
101980986	Lucas Martins Moreira	lmmoreira.2005@gmail.com	Student Member	Active	2026	Minas Gerais Section	Juiz De Fora	Minas Gerais	MEMAES010
101981030	LEONARDO FREITAS KELMER DE OLIVEIRA	kelmerleo50@gmail.com	Student Member	Active	2026	Minas Gerais Section	Juiz de fora	Minas Gerais	MEMAES010
102213574	maria antonia almeida braga	mariaantoniadealmeidabraga@hotmail.com	Student Member	Active	2026	Minas Gerais Section	Juiz de Fora	Minas Gerais	MEMC016;MEME025;MEMIA034;MEMPE031;MEMRA024
102365380	Lauro Roney Junior	lauro.junior@estudante.ufjf.br	Student Member	Active	2026	Minas Gerais Section	Juiz de Fora	Minas Gerais	MEMIA034
102374028	Pedro Lucas Santos Silva	pedluu27@gmail.com	Student Member	Active	2026	Minas Gerais Section	Juiz de Fora	Minas Gerais	MEMAES010;MEMC016
102377021	Caio Leite Fernandes	blackandwhiterc@outlook.com	Student Member	Active	2026	Minas Gerais Section	Juiz de Fora	Minas Gerais	MEMC016
102379773	Caio Augusto Teixeira	caioaugustodepaiva@gmail.com	Student Member	Active	2026	Minas Gerais Section	Juiz de Fora	Minas Gerais	MEMC016
102380238	Luan Brandao de Oliveira	luanbrandaodeoliveira@gmail.com	Student Member	Active	2026	Minas Gerais Section	Juiz de Fora	Minas Gerais	MEMAES010;MEMC016
102383162	Thiago Henrique Figueiredo	thiagohf2008@gmail.com	Student Member	Active	2026	Minas Gerais Section	Juiz de Fora	Minas Gerais	MEMC016;MEMCAS004;MEMPE031;MEMRA024
102383843	Pedro Henrique Da Silva Mendes Santos	pedrohenrique.mendes@estudante.ufjf.br	Student Member	Active	2026	Minas Gerais Section	Juiz de Fora	Minas Gerais	MEMC016;MEMPE031
102390404	Miguel Silva de Mattos	miguel.mattos@estudante.ufjf.br	Student Member	Active	2026	Minas Gerais Section	Juiz de Fora	Minas Gerais	MEMIA034
102396983	Arthur Caetano Horta de Lima	arthurcaetanohl@gmail.com	Student Member	Active	2026	Minas Gerais Section	Juiz de Fora	Minas Gerais	MEMAP003;MEMC016;MEMCOM019;MEME025;MEMPE031
102397012	Larissa Neto Macario de Oliveira	lisanmo02@gmail.com	Student Member	Active	2026	Minas Gerais Section	Juiz de Fora	Minas Gerais	MEMAP003;MEMCOM019;MEMIA034;MEMPE031
102397018	Guilherme Omar Silva	guilherme.omars@gmail.com	Student Member	Active	2026	Minas Gerais Section	Juiz de Fora	Minas Gerais	MEMAP003;MEMC016;MEMCOM019;MEME025;MEMPE031
102397025	Pedro Henrique de Oliveira Fernandes	pedrohenrique129fernandes129@gmail.com	Student Member	Active	2026	Minas Gerais Section	Juiz de Fora	Minas Gerais	MEMAP003;MEMC016;MEMCOM019;MEME025;MEMPE031
102397053	Walison Furtado da Silveira	walisonf600@gmail.com	Student Member	Active	2026	Minas Gerais Section	Juiz de Fora	Minas Gerais	MEMAP003;MEMC016;MEMCOM019;MEME025;MEMIA034;MEMPE031
102397057	Lucas Krempser Couto	krempserlucas@gmail.com	Student Member	Active	2026	Minas Gerais Section	Juiz de Fora	Minas Gerais	MEMAP003;MEMC016;MEMCOM019;MEME025;MEMPE031
102397069	Artur Lima Dias	limadias9912@gmail.com	Student Member	Active	2026	Minas Gerais Section	Juiz de Fora	Minas Gerais	MEMC016;MEME025;MEMRA024
102397178	Alberto Raikkoene Briguenti de Sa	raikkoen13@gmail.com	Student Member	Active	2026	Minas Gerais Section	Juiz de Fora	Minas Gerais	MEMAP003;MEMC016;MEMCOM019;MEME025;MEMIA034;MEMPE031;MEMRA024
102397413	Henrique Vieira Fadiga	rickee.fadiga@gmail.com	Student Member	Active	2026	Minas Gerais Section	Juiz de Fora	Minas Gerais	MEMAP003;MEMC016;MEMCOM019;MEME025;MEMPE031
102397678	Lucas Gabriel Marcato Esposito	lucas.esposito@estudante.ufjf.br	Student Member	Active	2026	Minas Gerais Section	Juiz de Fora	Minas Gerais	MEMAP003;MEMCOM019;MEME025;MEMIA034;MEMPE031
102400232	Gabriel Neves Barbosa Silva	gabrielnbsilva@gmail.com	Student Member	Active	2026	Minas Gerais Section	Sao Joao del Rei		MEMAES010;MEMAP003;MEMC016;MEMCOM019;MEME025;MEMIA034;MEMPE031
102402492	Emanuel dos Santos Silva Galvond	emanueldssgalvond032@gmail.com	Student Member	Active	2026	Minas Gerais Section	Juiz de Fora	Minas Gerais	MEMAP003;MEMC016;MEMCOM019;MEME025;MEMIA034;MEMPE031
102405719	ISADORA DE ALMEIDA LOPES	isaalopes4114@gmail.com	Student Member	Active	2026	Minas Gerais Section	Juiz de Fora	Minas Gerais	MEMAP003;MEMC016;MEMCOM019;MEME025;MEMIA034;MEMPE031;MEMRA024
102405749	Breno Pacheco Cunha	breno.pacheco@estudante.ufjf.br	Student Member	Active	2026	Minas Gerais Section	juiz de fora	Minas Gerais	MEMAP003;MEMC016;MEME025;MEMIA034;MEMPE031
102405870	Caio Silva Oliveira	caiopocoyo_jf@hotmail.com	Student Member	Active	2026	Minas Gerais Section	Juiz de Fora	Minas Gerais	MEMAP003;MEMC016;MEMCOM019;MEME025;MEMIA034;MEMPE031;MEMRA024
102431341	Guilherme Barbosa Rezende	gb087443@gmail.com	Student Member	Active	2026	Minas Gerais Section	Juiz de Fora	Minas Gerais	MEMAES010;MEMAP003;MEMRA024
102431342	Gabriel Cabral Gouvea Vasconcellos	gabrielcgv10@gmail.com	Student Member	Active	2026	Minas Gerais Section	Juiz de Fora	Minas Gerais	MEMAES010;MEMAP003;MEMRA024
102437072	Matheus Teixeira dos Santos	matheustds013@gmail.com	Student Member	Active	2026	Minas Gerais Section	Juiz de fora	Minas Gerais	MEMAP003;MEMC016;MEMCOM019;MEME025;MEMIA034;MEMPE031
102439515	Vitor Dulce Conde	vitor.conde@estudante.ufjf.br	Student Member	Active	2026	Minas Gerais Section	Juiz De fora		MEMAP003;MEMC016;MEMCOM019;MEME025;MEMIA034;MEMPE031;MEMRA024
102439930	HEITOR SILVA PINTO	heitorsilva.pinto@estudante.ufjf.br	Student Member	Active	2026	Minas Gerais Section	Juiz de Fora	Minas Gerais	MEMAP003;MEMC016;MEMCOM019;MEME025;MEMIA034;MEMPE031;MEMRA024
102440016	Livia Lourenco Nadalin	livianadalin20@gmail.com	Student Member	Active	2026	Minas Gerais Section	juiz de fora	Minas Gerais	MEMAP003;MEMC016;MEMCOM019;MEME025;MEMIA034;MEMPE031;MEMRA024
102440098	Jose Simoes Araujo Neto	josesimoesk10@gmail.com	Student Member	Active	2026	Minas Gerais Section	Juiz de Fora	Minas Gerais	MEMAP003;MEMC016;MEMCOM019;MEME025;MEMIA034;MEMPE031;MEMRA024
102440102	Leandro Cipriano de Resende	15329327660@estudante.ufjf.br	Student Member	Active	2026	Minas Gerais Section	Juiz de Fora	Minas Gerais	MEMAP003;MEMC016;MEMCAS004;MEMCOM019;MEME025;MEMIA034;MEMPE031;MEMRA024
102445856	Joao Gabriel Lassarotti	joao.lassarotti@estudante.ufjf.br	Student Member	Active	2026	Minas Gerais Section	Juiz de Fora	Minas Gerais	MEMIA034;MEMRA024
102466176	Vitorio Santos Mendes	vitoriosmendes3@gmail.com	Student Member	Active	2026	Minas Gerais Section	Juiz de Fora	Minas Gerais	MEMAES010
102475237	giordano bruno gallo martuchelli	bruno.giordano@estudante.ufjf.br	Student Member	Active	2026	Minas Gerais Section	juiz de fora	Minas Gerais	MEMAP003;MEMC016;MEMCOM019;MEME025;MEMIA034;MEMPE031
102403842	Sillas Henrique Pereira	sillash178@gmail.com	Student Member	Active	2026	South Brazil Section	Santos Dumont	Minas Gerais	MEMAP003;MEMC016;MEMCOM019;MEME025;MEMIA034;MEMPE031`;

function parseMembershipTsv(value) {
  const [headerLine, ...rows] = value.trim().split("\n");
  const headers = headerLine.split("\t");

  return rows.map((row) => {
    const columns = row.split("\t");
    const item = Object.fromEntries(headers.map((header, index) => [header, columns[index] || ""]));
    return {
      ...item,
      mainChapter: "Ramo",
      role: "Membro",
      societies: item.societies ? item.societies.split(";").filter(Boolean) : [],
      volunteerStatus: "Voluntário",
    };
  });
}

export const membershipMembers = parseMembershipTsv(membershipTsv);
