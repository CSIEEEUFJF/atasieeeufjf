
\NeedsTeXFormat{LaTeX2e}
\ProvidesClass{ataIAS}[2025/11/20 Classe para Atas IAS IEEE]
\LoadClass[12pt,a4paper]{article}
%===========================================%
%                PACOTES                    %
%===========================================%
\RequirePackage[utf8]{inputenc}
\RequirePackage{geometry}
\RequirePackage{graphicx}
\RequirePackage{caption}
\RequirePackage{booktabs}
\RequirePackage{array}
\RequirePackage{setspace}
\RequirePackage{xcolor}
\RequirePackage{titlesec}
\RequirePackage{enumitem}
\RequirePackage[most]{tcolorbox}
\RequirePackage{tikzpagenodes}
\RequirePackage{tcolorbox}
\RequirePackage{tikz}
\geometry{margin=2cm}
\setstretch{1.2}
%===========================================%
%                DEF. CORES                 %
%===========================================%
\definecolor{iasgreen}{RGB}{0,132,61}
\definecolor{iasblack}{RGB}{0,0,0}
\definecolor{ieeeblue}{RGB}{0,98,155}
\definecolor{ieecyan}{RGB}{0, 181, 226}
\definecolor{pesgreen}{RGB}{120,190,32}
\definecolor{rasred}{RGB}{152,0,46}
\definecolor{raspurple}{RGB}{97,17,106}
\titleformat{\section}{\color{ieeeblue}\Large\bfseries}{}{0pt}{}
\titleformat{\subsection}{\color{pesgreen}\bfseries\normalsize}{}{0pt}{}
%===========================================%
%          CABEÇALHO E CAIXAS               %
%===========================================%

\newtcolorbox{titulofaixa}[1][]{
    enhanced,
    sharp corners,
    colback=iasgreen!85,
    colframe=iasgreen!85,
    boxrule=0pt,
    arc=0pt,
    left=8pt,
    right=8pt,
    top=2pt,
    bottom=6pt,
    width=\textwidth,
    enlarge left by=0pt,
    enlarge right by=0pt,
    fontupper=\sffamily\bfseries\large\color{white},
    underlay={                % detalhe de faixa dupla
        \fill[iasgreen!60]
            ([yshift=-2pt]frame.south west) rectangle
            ([yshift=-4pt]frame.south east);
    },
    title=#1
}

\newtcolorbox{pescabecaixa}{
    enhanced,
    colback=white,
    colframe=white,
    boxrule=0pt,
    top=4pt,
    bottom=8pt,
    left=4pt,
    right=4pt,
    arc=0pt,
    overlay={       
      \draw[iasgreen, line width=3pt] (frame.north west) -- (frame.north east);
        \draw[iasblack, line width=1.5pt] (frame.south west) -- (frame.south east);
    }
        }
\newtcolorbox{pesbox}[1][]{
  title = #1,  
  colback = white, 
    colframe = iasgreen, 
    boxrule = 0.2pt, 
    toprule = 6pt, 
    arc = 0pt
}

\newtcolorbox{bluebox}[1][]{
  title = #1,  
  colback = white, 
    colframe = iasblack, 
    boxrule = 0.2pt, 
    toprule = 6pt, 
    arc = 0pt
}
%===========================================%
%                COMANDOS                   %
%===========================================%

% -----------CABEÇALHO----------------------%
\newcommand{\cabecalho}{

\begin{pescabecaixa}

\begin{center}
\begin{tabular}{p{2.7cm} p{10cm} p{3cm}}
    
  \centering\raisebox{0pt}{\includegraphics[width=3cm]{imagens/IEEE_logo.png}} &
    
    \centering
    \vspace{-1.4cm}
    {\Large \textbf{\color{iasgreen}Capítulo IAS}}\\[2pt]
    {\large \textbf{\color{iasblack}Ramo Estudantil IEEE – UFJF}}\\[2pt]
    {\small Universidade Federal de Juiz de Fora – MG, Brasil}\\[-2pt]
    {\small https://edu.ieee.org/br-ufjf/}&
    
  
    \centering\includegraphics[width=3cm]{imagens/IAS_logo-eps-converted-to.pdf}
\end{tabular}
\end{center}
\vspace{-0.8cm}
\begin{center}
  {\Huge\sffamily\bfseries\color{iasgreen}{ATA DE REUNIÃO}}
\end{center}

\end{pescabecaixa}
\vspace{0.2cm}
}
%---------------FAIXA DE TITULO ----------------------%
\newcommand{\faixatitulo}[1]{
    \begin{titulofaixa}{#1}\end{titulofaixa}
}
%-------------INFORMAÇÕES BÁSICAS ---------------------%
\newcommand{\info}[4]{
  \begin{pesbox}[\centering \Large \sffamily\bfseries\color{white}{INFORMAÇÕES BÁSICAS}]

\renewcommand{\arraystretch}{1.5}
\begin{tabular}{p{4.5cm} p{9cm}}
\textbf{Data da elaboração:} & #1 \\
\textbf{Autor:} & #2 \\
\textbf{Data da Reunião:} & #3 \\
\textbf{Local da Reunião:} & #4 \\
\end{tabular}

\end{pesbox}
\vspace{0.4cm}
}

%----------------MEMBROS--------------------%
\newenvironment{membros}{
  \begin{bluebox}[\centering \centering \Large \sffamily\bfseries\color{white}{MEMBROS PRESENTES}]

\renewcommand{\arraystretch}{1.35}

\begin{tabular}{p{1cm} p{8cm} p{5cm}}
\textbf{ ~} & \textbf{Nome} & \textbf{Cargo / Função} \\[4pt]
}{
\end{tabular}

\vspace{6pt}
\end{bluebox}
\vspace{0.6cm}
}
\newcommand{\membro}[3]{#1 & #2 & #3 \\ \hline}



%---------------PAUTAS------------------%
\newenvironment{pautas}{
  \faixatitulo{\Large \textbf{Pautas da Reunião}}
\begin{enumerate}[leftmargin=1cm]
}{
\end{enumerate}
}
\newcommand{\pauta}[1]{\item \textbf{#1}}



%------------RESULTADOS------------------%

\newenvironment{resultados}{
\faixatitulo{\Large Resultados das Pautas}
\begin{enumerate}[leftmargin=1cm]
}{
\end{enumerate}
}
\newcommand{\resultado}[1]{\item #1}



%------------ANEXOS-----------------------%

\newcounter{anexocount}

\newenvironment{anexos}{
    \faixatitulo{Anexos}
    \setcounter{anexocount}{0}
    \vspace{0.5cm}
}{
    \vspace{0.3cm}
}

\newcommand{\anexo}[2]{
    \stepcounter{anexocount}

    % bloco da imagem
    \begin{minipage}{0.48\linewidth}
        \centering
        \includegraphics[width=\linewidth]{#2}
        \captionof*{figure}{\textbf{Anexo \arabic{anexocount}}: #1}
    \end{minipage}
    \hfill
    \vspace{0.4cm}
}

%------------ASSINATURAS------------------%

\newcommand{\assinaturas}{
\vspace{1.5cm}
\begin{minipage}{0.45\textwidth}
\rule{7cm}{0.4pt}\\
\centering \textbf{\color{iasgreen}Presidente do \\ Capítulo IAS - UFJF}
\end{minipage}
\hfill
\begin{minipage}{0.4\textwidth}
\rule{7cm}{0.4pt}\\
\centering \textbf{\color{iasblack}Vice-presidente\\ do Capítulo IAS - UFJF}
\end{minipage}
}
