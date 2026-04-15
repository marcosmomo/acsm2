# CPS7 Flow Replication Report

## Comparative
### CPS7 -> CPS2
- formalCpsId: `CPS-002`
- cpsName: `CNC_5Eixos_Evo`
- baseTopic: `cps2`
- features: `desbaste`, `acabamento`, `probin`
- sensors: `Velocidade_Spindle`, `Posicao_Eixo_X`, `Posicao_Eixo_Y`, `Temperatura_Spindle`, `Vibracao_Estrutura`
- local MQTT: `cps2/cmd`, `cps2/status`, `cps2/ack`, `cps2/health`, `cps2/data`, `cps2/oee`, `cps2/alarm`
- ACSM MQTT: `acsm2/cps2/oee`, `acsm2/cps2/learning`
- federation MQTT optional: `acsm/cps2/oee`, `acsm/cps2/learning`

### CPS7 -> CPS4
- formalCpsId: `CPS-004`
- cpsName: `AGV_Logistico_Zeta`
- baseTopic: `cps4`
- features: `navegacao`, `pickup_delivery`, `docking`
- sensors: `Bateria`, `Velocidade`, `Posicao_Mapa`, `Distancia_Obstaculo`, `Status_Motor_Tração`
- local MQTT: `cps4/cmd`, `cps4/status`, `cps4/ack`, `cps4/health`, `cps4/data`, `cps4/oee`, `cps4/alarm`
- ACSM MQTT: `acsm2/cps4/oee`, `acsm2/cps4/learning`
- federation MQTT optional: `acsm/cps4/oee`, `acsm/cps4/learning`

### CPS7 -> CPS6
- formalCpsId: `CPS-006`
- cpsName: `BufferLine_50467`
- baseTopic: `cps6`
- features: `zone1_release`, `zone2_release`, `zone3_release`, `detectar_zone1`, `detectar_zone2`, `detectar_zone3`
- sensors: `NominalVoltage_24V`, `Zone1_Occupied`, `Zone2_Occupied`, `Zone3_Occupied`, `MotorCurrent`, `MotorTemperature`
- local MQTT: `cps6/cmd`, `cps6/status`, `cps6/ack`, `cps6/health`, `cps6/data`, `cps6/oee`, `cps6/alarm`
- ACSM MQTT: `acsm2/cps6/oee`, `acsm2/cps6/learning`
- federation MQTT optional: `acsm/cps6/oee`, `acsm/cps6/learning`

## Nodes Adapted
- Gerar estado da funcionalidade fazer expedição
- Simula envio dos dados da planta 2
- Init estado PLAY
- Liberar operações só em PLAY
- Controlar PLAY/STOP
- Unplug por falha manutenção
- Simular replacement
- gate com trava e auto-reset 
- Calcular health do CPS
- gerar dado imediato ao play
- calcular estado global do CPS
- calcular OEE CPS
- preparar sensor data
- Preparar OperationalData (AAS)
- Preparar fim manutenção automática
- Retorno automático após manutenção
- Logar publicação MQTT
- Converter JSONL → JSON
- montar log
- preparar rotacao
- decidir rotacao
- Gerar telemetria operacional CPS2
- API CPS2 Description
- API CPS2 Summary
- API CPS2 Indicators
- API CPS2 History
- API CPS2 Health
- API CPS2 Status
- API CPS2 Data
- API CPS2 OEE
- API CPS2 Interfaces
- API CPS2 Lifecycle
- API CPS2 ACSM
- API CPS2 Ping
- API CPS2 Command Input
- Normalizar evento persistente CPS2
- Preparar leitura resumo histórico
- Resumo histórico CPS2
- Preparar leitura histórico CPS2
- Montar resposta histórico CPS2
- Preparar leitura logs rotativos (export)
- Converter JSONL → JSON
- Preparar leitura logs rotativos (export)
- Converter JSONL → JSON
- Preparar leitura HTML científico
- Montar HTML científico CPS2
- Preparar geração PDF
- Definir arquivo PDF
- Preparar download PDF
- Definir arquivo JSON
- Preparar download JSON
- Montar HTML estático CPS2
- Definir arquivo datasheet PDF
- Preparar resposta datasheet PDF
- definir topicos MQTT
- persistir historico localmente em historico resumido
- Local Times-Series Features
- Local Learning CPS2
- Local Reasoning CPS2
- Build CPS2 Payload for ACSM

## Variable Parameters
### CPS2
- cpsId: `cps2`
- formalCpsId: `CPS-002`
- cpsName: `CNC_5Eixos_Evo`
- baseTopic: `cps2`
- endpoints: `DescriptionEndpoint=http://localhost:3000/api/acsm2/cps2/description`, `SummaryEndpoint=http://localhost:3000/api/acsm2/cps2/summary`, `IndicatorsEndpoint=http://localhost:3000/api/acsm2/cps2/indicators`, `HistoryEndpoint=http://localhost:3000/api/acsm2/cps2/history`, `HealthEndpoint=http://localhost:3000/api/acsm2/cps2/health`

### CPS4
- cpsId: `cps4`
- formalCpsId: `CPS-004`
- cpsName: `AGV_Logistico_Zeta`
- baseTopic: `cps4`
- endpoints: `DescriptionEndpoint=http://localhost:3000/api/acsm2/cps4/description`, `SummaryEndpoint=http://localhost:3000/api/acsm2/cps4/summary`, `IndicatorsEndpoint=http://localhost:3000/api/acsm2/cps4/indicators`, `HistoryEndpoint=http://localhost:3000/api/acsm2/cps4/history`, `HealthEndpoint=http://localhost:3000/api/acsm2/cps4/health`

### CPS6
- cpsId: `cps6`
- formalCpsId: `CPS-006`
- cpsName: `BufferLine_50467`
- baseTopic: `cps6`
- endpoints: `DescriptionEndpoint=http://localhost:3000/api/acsm2/cps6/description`, `SummaryEndpoint=http://localhost:3000/api/acsm2/cps6/summary`, `IndicatorsEndpoint=http://localhost:3000/api/acsm2/cps6/indicators`, `HistoryEndpoint=http://localhost:3000/api/acsm2/cps6/history`, `HealthEndpoint=http://localhost:3000/api/acsm2/cps6/health`

## Generated Files
- [cps2-flow.json](/C:/bkp/estagio%20doutoral/Implementa??o%20de%20IC/acsm-main/ACSM-2/node-red/cps2-flow.json)
- [cps4-flow.json](/C:/bkp/estagio%20doutoral/Implementa??o%20de%20IC/acsm-main/ACSM-2/node-red/cps4-flow.json)
- [cps6-flow.json](/C:/bkp/estagio%20doutoral/Implementa??o%20de%20IC/acsm-main/ACSM-2/node-red/cps6-flow.json)
- [cps2-function-nodes.md](/C:/bkp/estagio%20doutoral/Implementa??o%20de%20IC/acsm-main/ACSM-2/node-red/function-nodes/cps2-function-nodes.md)
- [cps4-function-nodes.md](/C:/bkp/estagio%20doutoral/Implementa??o%20de%20IC/acsm-main/ACSM-2/node-red/function-nodes/cps4-function-nodes.md)
- [cps6-function-nodes.md](/C:/bkp/estagio%20doutoral/Implementa??o%20de%20IC/acsm-main/ACSM-2/node-red/function-nodes/cps6-function-nodes.md)

## Import Checklist
- Importar um flow por vez no Node-RED.
- Confirmar credenciais/brokers MQTT ap?s importa??o.
- Verificar rotas HTTP `/api/<cps>/*` criadas no editor.
- Testar `cmd -> ack/status`.
- Testar publica??o em `<cps>/data`, `<cps>/oee`, `acsm2/<cps>/learning`.
- Validar datasheet e paths de arquivo no ambiente do Node-RED.

## Important Notes
- Os flows foram clonados a partir da topologia do CPS7 com substitui??es estruturais seguras.
- O contrato MQTT local e ACSM foi preservado no naming e nas rotas.
- Os Function Nodes exportados em Markdown permitem revis?o manual dos trechos ainda heur?sticos.
- A l?gica interna ainda herda parte da sem?ntica do CPS7; para produ??o, revise primeiro os n?s de feature-state, telemetria, OEE, learning e reasoning.