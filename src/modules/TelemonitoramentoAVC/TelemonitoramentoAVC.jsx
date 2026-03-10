import { useState, useEffect } from 'react'
import Header from '../../components/Header'
import Footer from '../../components/Footer'
import { ToastContainer, toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import FormCadastro from './components/FormCadastro'
import FormAcolhimento from './components/FormAcolhimento'
import FormExames from './components/FormExames'
import FormAgendamento from './components/FormAgendamento'
import FormDesfecho from './components/FormDesfecho'
import FormContatos from './components/FormContatos'
import FormEmail from './components/FormEmail'
import FormPerfil from './components/FormPerfil'
import FormEncerrar from './components/FormEncerrar'
import DashboardAVC from './components/DashboardAVC'
import ConfiguracoesAVC from './components/ConfiguracoesAVC'

export default function TelemonitoramentoAVC() {
    const [activeTab, setActiveTab] = useState('painel')
    const [loading, setLoading] = useState(false)
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
    const [isCollapsed, setIsCollapsed] = useState(true);

    useEffect(() => {
        document.title = "NEXUS HMSJ | Telemonitoramento AVC"
    }, [])

    const iconeAVC = (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
    )

    const menuGroups = [
        {
            title: 'Geral',
            items: [
                { id: 'painel', label: 'Painel Geral', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /> }
            ]
        },
        {
            title: 'Jornada do Paciente',
            items: [
                { id: 'cadastro', label: 'Novo Paciente', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /> },
                { id: 'triagem', label: 'Triagem / Acolhimento', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /> },
                { id: 'exames', label: 'Checar Exames', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /> },
                { id: 'agendar', label: 'Agendar Consulta', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /> },
                { id: 'desfecho', label: 'Registrar Desfecho', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" /> }
            ]
        },
        {
            title: 'Operacional',
            items: [
                { id: 'contato', label: 'Registrar Contato (CRM)', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /> },
                { id: 'ambulatorio', label: 'Lista Ambulatorial', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 19v-8.93a2 2 0 01.89-1.664l7-4.666a2 2 0 012.22 0l7 4.666A2 2 0 0121 10.07V19M14 10.88v4.24a2 2 0 01-1 1.73l-2 .5-2-.5A2 2 0 018 15.12v-4.24a2 2 0 011-1.73l2-.5 2 .5a2 2 0 011 1.73z" /> },
                { id: 'perfil', label: 'Prontuário / Perfil', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" /> }
            ]
        },
        {
            title: 'Configuração e Dados',
            items: [
                { id: 'config', label: 'Configurações Clínicas', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /> },
                { id: 'encerrar', label: 'Óbito / Exclusão', danger: true, icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /> }
            ]
        }
    ]

    return (
        <div className="min-h-screen flex flex-col font-sans bg-[#F8F9FA] relative">
            {/* Banner Neurológico Topo */}
            <div className="absolute top-0 left-0 w-full h-48 bg-sky-900/5 overflow-hidden pointer-events-none z-0">
                <svg className="absolute -top-24 -right-12 w-96 h-96 text-sky-500/10 opacity-50" fill="currentColor" viewBox="0 0 100 100">
                    <path d="M50 0C22.4 0 0 22.4 0 50s22.4 50 50 50 50-22.4 50-50S77.6 0 50 0zm0 90c-22.1 0-40-17.9-40-40s17.9-40 40-40 40 17.9 40 40-17.9 40-40 40z" />
                    <circle cx="50" cy="50" r="15" />
                    <path d="M50 20v15M80 50H65M50 80V65M20 50h15M30 30l10 10M70 30L60 40M70 70L60 60M30 70l10-10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
            </div>

            <div className="relative z-10 flex flex-col w-full">
                <Header
                    title="Telemonitoramento AVC (Pós-Alta)"
                    icon={iconeAVC}
                    badge="Módulo Clínico"
                    description="Acompanhamento contínuo e preventivo de pacientes pós-AVC"
                />
            </div>

            <div className="flex flex-1 overflow-hidden relative z-10">

                {/* Overlay Background para Mobile */}
                {isMobileMenuOpen && (
                    <div
                        className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 md:hidden"
                        onClick={() => setIsMobileMenuOpen(false)}
                    ></div>
                )}

                {/* Sidebar Esquerda (Drawer no Mobile, Fixo no Desktop) */}
                <aside className={`fixed inset-y-0 left-0 ${isCollapsed ? 'w-20' : 'w-64'} bg-white border-r border-slate-200 flex flex-col shadow-xl z-50 transform transition-all duration-300 ease-in-out md:relative ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>

                    {/* Header Sidebar Mobile */}
                    <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between md:hidden">
                        <span className="font-bold text-sky-700 text-sm whitespace-nowrap">Menu Nexus</span>
                        <button onClick={() => setIsMobileMenuOpen(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Toggle Desktop */}
                    <div className={`p-4 border-b border-slate-100 bg-slate-50/50 hidden md:flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
                        {!isCollapsed && <h3 className="text-xs font-bold tracking-widest text-slate-400 uppercase whitespace-nowrap overflow-hidden transition-all duration-300">Menu de Navegação</h3>}
                        <button onClick={() => setIsCollapsed(!isCollapsed)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 focus:outline-none transition-colors mx-auto md:mx-0" title={isCollapsed ? "Expandir Menu" : "Recolher Menu"}>
                            <svg className={`w-5 h-5 transform transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                            </svg>
                        </button>
                    </div>

                    <nav className="flex-1 overflow-y-auto pt-2 pb-6 custom-scrollbar overflow-x-hidden">
                        {menuGroups.map((group, gIdx) => (
                            <div key={gIdx} className="mb-4">
                                <h3 className={`text-[10px] font-bold text-slate-400 px-5 mb-2.5 uppercase tracking-wider whitespace-nowrap transition-all duration-300 ${isCollapsed ? 'opacity-0 h-0 hidden m-0 p-0' : 'opacity-100'}`}>
                                    {group.title}
                                </h3>
                                <div className="px-3 space-y-1">
                                    {group.items.map((item) => (
                                        <button
                                            key={item.id}
                                            onClick={() => {
                                                setActiveTab(item.id);
                                                setIsMobileMenuOpen(false);
                                            }}
                                            title={isCollapsed ? item.label : undefined}
                                            className={`group w-full flex items-center ${isCollapsed ? 'justify-center' : 'justify-start gap-3'} px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${activeTab === item.id
                                                ? (item.danger ? 'bg-rose-50 text-rose-700 shadow-sm border border-rose-100' : 'bg-sky-50 text-sky-700 shadow-sm border border-sky-100')
                                                : (item.danger ? 'text-slate-600 hover:bg-rose-50 hover:text-rose-700 border border-transparent' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent')
                                                }`}
                                        >
                                            <svg className={`shrink-0 w-5 h-5 ${activeTab === item.id
                                                ? (item.danger ? 'text-rose-500' : 'text-sky-500')
                                                : (item.danger ? 'text-slate-400 group-hover:text-rose-400' : 'text-slate-400')
                                                }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                {item.icon}
                                            </svg>
                                            <span className={`whitespace-nowrap transition-all duration-300 ${isCollapsed ? 'opacity-0 w-0 hidden' : 'opacity-100'}`}>{item.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </nav>
                </aside>

                {/* Conteúdo Principal Adaptativo */}
                <main className="flex-1 overflow-y-auto p-3 sm:p-6 lg:p-8 bg-transparent">
                    {/* Botão de Hambúrguer Mobile */}
                    <div className="md:hidden flex items-center mb-4 bg-white p-3 rounded-xl shadow-sm border border-slate-200">
                        <button
                            onClick={() => setIsMobileMenuOpen(true)}
                            className="p-2 mr-3 text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors focus:ring-2 focus:ring-sky-500"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        </button>
                        <h2 className="font-semibold text-slate-700 text-sm tracking-wide flex-1 text-center pr-10">
                            {menuGroups.flatMap(g => g.items).find(i => i.id === activeTab)?.label || 'Telemonitoramento'}
                        </h2>
                    </div>

                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-full gap-4 text-sky-500 mt-10">
                            <svg className="w-10 h-10 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span className="text-sm font-medium tracking-widest uppercase text-slate-500">Preparando ambiente...</span>
                        </div>
                    ) : (
                        <div className="animate-fadeIn">
                            {activeTab === 'painel' && <DashboardAVC />}
                            {activeTab === 'cadastro' && <FormCadastro />}
                            {activeTab === 'perfil' && <FormPerfil />}
                            {activeTab === 'triagem' && <FormAcolhimento />}
                            {activeTab === 'exames' && <FormExames />}
                            {activeTab === 'agendar' && <FormAgendamento />}
                            {activeTab === 'ambulatorio' && <FormEmail />}
                            {activeTab === 'desfecho' && <FormDesfecho />}
                            {activeTab === 'contato' && <FormContatos />}
                            {activeTab === 'encerrar' && <FormEncerrar />}
                            {activeTab === 'config' && <ConfiguracoesAVC />}

                            {activeTab !== 'painel' && activeTab !== 'cadastro' && activeTab !== 'perfil' && activeTab !== 'triagem' && activeTab !== 'exames' && activeTab !== 'agendar' && activeTab !== 'ambulatorio' && activeTab !== 'desfecho' && activeTab !== 'contato' && activeTab !== 'encerrar' && activeTab !== 'config' && (
                                <div className="w-full h-64 border-2 border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center text-slate-400 bg-white/50">
                                    <svg className="w-12 h-12 mb-3 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                    </svg>
                                    <p className="text-sm font-medium text-center px-4">Área "<strong>{menuGroups.flatMap(g => g.items).find(i => i.id === activeTab)?.label}</strong>" em construção.</p>
                                </div>
                            )}
                        </div>
                    )}
                </main>
            </div>

            <Footer />
            <ToastContainer position="bottom-right" theme="light" />
        </div>
    )
}
