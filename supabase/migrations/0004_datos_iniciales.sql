-- Mascotas de demostración para el catálogo.
INSERT INTO mascotas.mascotas (nombre, especie, raza, edad_meses, tamano, sexo, descripcion) VALUES
  ('Canela',  'perro',  'Criolla',         26, 'mediano', 'hembra', 'Llegó a la fundación después de vivir en una bodega del barrio Santa Clara. Camina bien con correa y se lleva bien con niños.'),
  ('Tinto',   'perro',  'Criollo',         60, 'grande',  'macho',  'Grande y tranquilo. Necesita patio y dos paseos al día. Le cuesta compartir la comida con otros perros.'),
  ('Arepa',   'perro',  'Criolla',          7, 'pequeno', 'hembra', 'Cachorra con mucha energía. Todavía aprende a quedarse sola y muerde lo que encuentra en el piso.'),
  ('Bocadillo','gato',  'Mestizo naranja', 14, 'pequeno', 'macho',  'Rescatado de un techo en el centro de Ocaña. Duerme casi todo el día y busca compañía por las noches.'),
  ('Luna',    'gato',   'Mestiza negra',   38, 'pequeno', 'hembra', 'Tímida los primeros días. Convive con otros gatos y prefiere un hogar sin perros.'),
  ('Mochilo', 'gato',   'Mestizo atigrado', 9, 'pequeno', 'macho',  'Juguetón y curioso. La casa debe tener mallas en las ventanas.'),
  ('Panela',  'conejo', 'Mini lop',        18, 'pequeno', 'hembra', 'Come heno y verduras frescas. Necesita un espacio seguro para moverse fuera de la jaula.'),
  ('Sancocho','perro',  'Criollo',         84, 'mediano', 'macho',  'Perro adulto y calmado. Se recupera de una cirugía en la pata trasera, así que por ahora no está disponible.');

UPDATE mascotas.mascotas SET estado = 'en_tratamiento' WHERE nombre = 'Sancocho';
