from flask import Flask, request, jsonify
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
import os

app = Flask(__name__)

# 1. ENTRENAMIENTO AL INICIAR EL SERVIDOR
print("Iniciando Microservicio de IA...")
directorio_actual = os.path.dirname(os.path.abspath(__file__))
ruta_csv = os.path.join(directorio_actual, 'dataset_alumnos.csv')

datos = pd.read_csv(ruta_csv)
X = datos[['asistencia_pct', 'promedio_notas', 'tareas_entregadas', 'reportes_conducta']]
y = datos['riesgo_desercion']

modelo_rf = RandomForestClassifier(n_estimators=100, random_state=42)
modelo_rf.fit(X, y)
print("Modelo Random Forest entrenado y listo para predecir.")

# 2. ENDPOINT QUE ESCUCHA A C#
@app.route('/predecir', methods=['POST'])
def predecir_riesgo():
    try:
        # Recibir los datos JSON que envía C#
        datos_entrada = request.get_json()
        
        # Extraer las métricas
        asistencia = datos_entrada.get('asistenciaPct', 0)
        promedio = datos_entrada.get('promedioNotas', 0)
        tareas = datos_entrada.get('tareasEntregadas', 0)
        reportes = datos_entrada.get('reportesConducta', 0)
        
        # Formatear para el modelo predictivo
        alumno_df = pd.DataFrame([[asistencia, promedio, tareas, reportes]], 
                                columns=['asistencia_pct', 'promedio_notas', 'tareas_entregadas', 'reportes_conducta'])
        
        # Realizar la predicción
        prediccion = modelo_rf.predict(alumno_df)[0]
        probabilidades = modelo_rf.predict_proba(alumno_df)
        riesgo_calculado = max(probabilidades[0]) * 100
        
        # Determinar recomendación
        recomendacion = "Continuar monitoreo regular."
        if prediccion == 'Alto':
            recomendacion = "Generar citación urgente con apoderado y tutor."
        elif prediccion == 'Medio':
            recomendacion = "Programar tutoría de refuerzo académico."
            
        # Devolver la respuesta en JSON
        return jsonify({
            "nivel": prediccion,
            "puntaje": round(riesgo_calculado, 2),
            "recomendaciones": recomendacion
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

# 3. LEVANTAR EL SERVIDOR EN EL PUERTO 5000
if __name__ == '__main__':
    app.run(port=5000, debug=True)