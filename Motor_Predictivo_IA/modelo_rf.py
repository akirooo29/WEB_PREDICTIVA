import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score
import json
import os

# 1. Cargar los datos tabulares (El archivo CSV que creamos)
print("Cargando datos históricos...")
datos = pd.read_csv('dataset_alumnos.csv')

# 2. Separar características (X) y la etiqueta a predecir (y)
X = datos[['asistencia_pct', 'promedio_notas', 'tareas_entregadas', 'reportes_conducta']]
y = datos['riesgo_desercion']

# 3. Entrenar el modelo Random Forest
print("Entrenando algoritmo Random Forest...")
modelo_rf = RandomForestClassifier(n_estimators=100, random_state=42)
modelo_rf.fit(X, y)

# (Opcional) Evaluar precisión si tuviéramos cientos de datos
# X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2)
# modelo_rf.fit(X_train, y_train)
# predicciones = modelo_rf.predict(X_test)
# print(f"Precisión del modelo: {accuracy_score(y_test, predicciones) * 100}%")

# 4. PRUEBA EN VIVO: Predecir un alumno nuevo (La magia de tu tesis)
print("\n--- SIMULANDO INGRESO DE NUEVO ALUMNO ---")
# Imagina que C# envía estos datos de un alumno desde React:
# 65% asistencia, nota promedio 10.5, 4 tareas entregadas, 1 reporte de conducta
nuevo_alumno = pd.DataFrame([[65, 10.5, 4, 1]], 
                            columns=['asistencia_pct', 'promedio_notas', 'tareas_entregadas', 'reportes_conducta'])

# El modelo predice el nivel de riesgo
prediccion = modelo_rf.predict(nuevo_alumno)
probabilidades = modelo_rf.predict_proba(nuevo_alumno)
riesgo_calculado = max(probabilidades[0]) * 100

# 5. Generar el JSON exacto que espera tu Frontend en React
resultado_json = {
    "estudiante_id": "99", # ID simulado
    "curso_id": "MAT-101",
    "puntaje": round(riesgo_calculado, 2),
    "nivel": prediccion[0],
    "recomendaciones": "Generar citación urgente con apoderado y tutor." if prediccion[0] == 'Alto' else "Continuar monitoreo regular."
}

print("\nJSON generado para enviar a C# y luego a React:")
print(json.dumps(resultado_json, indent=4))