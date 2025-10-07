import json
from collections import defaultdict

# Load the execution plan
with open('parallel_execution_plan.json', 'r') as f:
    plan = json.load(f)

# Load dependency and conflict data
with open('dependency_graph.json', 'r') as f:
    deps = json.load(f)
    
with open('conflict_graph.json', 'r') as f:
    conflicts = json.load(f)

print('=== PARALLELISM BOTTLENECK ANALYSIS ===\n')

# Analyze waves with low parallelism
waves = plan['execution_plan']['waves']
single_task_waves = [w for w in waves if w['parallel_task_count'] == 1]

print(f'Single-task waves: {len(single_task_waves)}/{len(waves)} ({len(single_task_waves)/len(waves)*100:.1f}%)')

# Build maps
dep_map = {d['task_id']: d['depends_on'] for d in deps}
conflict_map = {c['task_id']: c['conflicts_with'] for c in conflicts}

print('\n=== SINGLE-TASK WAVE ANALYSIS ===')
for wave in single_task_waves:
    task_id = wave['tasks'][0]['task_id']
    task_deps = dep_map.get(task_id, [])
    task_conflicts = conflict_map.get(task_id, [])
    
    print(f'Wave {wave["wave_number"]}: {task_id}')
    print(f'  Dependencies: {task_deps if task_deps else "None"}')
    print(f'  Conflicts with: {len(task_conflicts)} tasks')
    print()

# Find high-conflict tasks
print('=== HIGH-CONFLICT TASKS ===')
conflict_counts = [(task_id, len(conflicts)) for task_id, conflicts in conflict_map.items()]
conflict_counts.sort(key=lambda x: x[1], reverse=True)

for task_id, count in conflict_counts[:8]:
    if count > 0:
        print(f'  {task_id}: conflicts with {count} tasks')