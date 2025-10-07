#!/usr/bin/env python3
"""
Generate updated dependency and conflict graphs for improved tasks
"""

import json
from copy import deepcopy

def create_improved_dependencies():
    """Create updated dependency graph for improved tasks"""
    
    # Load original dependencies
    with open('dependency_graph.json', 'r') as f:
        original_deps = json.load(f)
    
    # Create mapping from original to new task IDs
    improved_deps = []
    
    # Process each original dependency and map to new task structure
    for dep in original_deps:
        task_id = dep['task_id']
        
        if task_id == 'T6a':
            # T6a split into T6a1, T6a2, T6a3
            improved_deps.extend([
                {**dep, "task_id": "T6a1", "expected_runtime_min": 12},
                {**dep, "task_id": "T6a2", "expected_runtime_min": 8},
                {**dep, "task_id": "T6a3", "expected_runtime_min": 6},
            ])
        elif task_id == 'T21':
            # T21 split into T21a, T21b, T21c - all depend on same tasks as original T21
            original_deps_list = dep['depends_on']
            improved_deps.extend([
                {**dep, "task_id": "T21a", "depends_on": original_deps_list, "expected_runtime_min": 12},
                {**dep, "task_id": "T21b", "depends_on": original_deps_list, "expected_runtime_min": 10}, 
                {**dep, "task_id": "T21c", "depends_on": original_deps_list, "expected_runtime_min": 8},
            ])
        elif task_id == 'T2a':
            # T2a split into T2a1, T2a2
            improved_deps.extend([
                {**dep, "task_id": "T2a1", "expected_runtime_min": 15},
                {**dep, "task_id": "T2a2", "expected_runtime_min": 20},
            ])
        elif task_id == 'T5':
            # T5 split into T5a, T5b
            improved_deps.extend([
                {**dep, "task_id": "T5a", "expected_runtime_min": 15},
                {**dep, "task_id": "T5b", "expected_runtime_min": 12},
            ])
        elif task_id == 'T1':
            # T1 split into T1a, T1b, T1c  
            improved_deps.extend([
                {**dep, "task_id": "T1a", "expected_runtime_min": 12},
                {**dep, "task_id": "T1b", "expected_runtime_min": 10},
                {**dep, "task_id": "T1c", "expected_runtime_min": 8},
            ])
        else:
            # Update dependencies that referenced split tasks
            updated_dep = deepcopy(dep)
            new_depends_on = []
            
            for dependency in dep['depends_on']:
                if dependency == 'T6a':
                    # Now depends on all T6a subtasks
                    new_depends_on.extend(['T6a1', 'T6a2', 'T6a3'])
                elif dependency == 'T2a':
                    # Depends on both T2a subtasks
                    new_depends_on.extend(['T2a1', 'T2a2'])
                elif dependency == 'T5':
                    # Depends on both T5 subtasks  
                    new_depends_on.extend(['T5a', 'T5b'])
                elif dependency == 'T1':
                    # Depends on all T1 subtasks
                    new_depends_on.extend(['T1a', 'T1b', 'T1c'])
                else:
                    new_depends_on.append(dependency)
            
            updated_dep['depends_on'] = new_depends_on
            improved_deps.append(updated_dep)
    
    return improved_deps

def create_improved_conflicts():
    """Create updated conflict graph for improved tasks"""
    
    # Load original conflicts
    with open('conflict_graph.json', 'r') as f:
        original_conflicts = json.load(f)
    
    improved_conflicts = []
    
    for conflict in original_conflicts:
        task_id = conflict['task_id']
        
        if task_id == 'T6a':
            # T6a subtasks have reduced conflicts since they work on different directories
            improved_conflicts.extend([
                {
                    "task_id": "T6a1",
                    "size": "S", 
                    "expected_runtime_min": 12,
                    "conflicts_with": ["T2a1", "T2a2", "T5b", "T9"],  # Reduced conflicts
                    "reasons": [
                        {"task": "T2a1", "reason": "both modify handler files"},
                        {"task": "T2a2", "reason": "both modify handler files"},
                        {"task": "T5b", "reason": "both modify service files"},
                        {"task": "T9", "reason": "both modify service files"}
                    ]
                },
                {
                    "task_id": "T6a2",
                    "size": "S",
                    "expected_runtime_min": 8, 
                    "conflicts_with": ["T2a2", "T5b", "T9"],  # Only conflicts with service-related tasks
                    "reasons": [
                        {"task": "T2a2", "reason": "both modify service files"},
                        {"task": "T5b", "reason": "both modify service files"},
                        {"task": "T9", "reason": "both modify service files"}
                    ]
                },
                {
                    "task_id": "T6a3", 
                    "size": "S",
                    "expected_runtime_min": 6,
                    "conflicts_with": ["T5a"],  # Minimal conflicts
                    "reasons": [
                        {"task": "T5a", "reason": "both modify type files"}
                    ]
                }
            ])
        elif task_id == 'T21':
            # T21 subtasks have reduced conflicts
            improved_conflicts.extend([
                {
                    "task_id": "T21a",
                    "size": "S",
                    "expected_runtime_min": 12,
                    "conflicts_with": ["T2a1", "T6a1"],  # Only handler conflicts
                    "reasons": [
                        {"task": "T2a1", "reason": "both modify handler files"},
                        {"task": "T6a1", "reason": "both modify handler files"}
                    ]
                },
                {
                    "task_id": "T21b",
                    "size": "S", 
                    "expected_runtime_min": 10,
                    "conflicts_with": ["T2a2", "T5b", "T6a2", "T8", "T9"],
                    "reasons": [
                        {"task": "T2a2", "reason": "both modify service files"},
                        {"task": "T5b", "reason": "both modify service files"},
                        {"task": "T6a2", "reason": "both modify service files"},
                        {"task": "T8", "reason": "both modify service files"},
                        {"task": "T9", "reason": "both modify service files"}
                    ]
                },
                {
                    "task_id": "T21c",
                    "size": "S",
                    "expected_runtime_min": 8,
                    "conflicts_with": ["T5a", "T6a3"],  # Only type/util conflicts
                    "reasons": [
                        {"task": "T5a", "reason": "both modify type files"},
                        {"task": "T6a3", "reason": "both modify util files"}
                    ]
                }
            ])
        elif task_id == 'T2a':
            # T2a split into file and code naming
            improved_conflicts.extend([
                {
                    "task_id": "T2a1",
                    "size": "S",
                    "expected_runtime_min": 15,
                    "conflicts_with": ["T6a1", "T21a"],  # Reduced conflicts - mainly file renames
                    "reasons": [
                        {"task": "T6a1", "reason": "both modify handler files"},
                        {"task": "T21a", "reason": "both modify handler files"}
                    ]
                },
                {
                    "task_id": "T2a2", 
                    "size": "M",
                    "expected_runtime_min": 20,
                    "conflicts_with": ["T5b", "T6a2", "T9", "T21b"],  # Code-level conflicts
                    "reasons": [
                        {"task": "T5b", "reason": "both modify service code"},
                        {"task": "T6a2", "reason": "both modify service code"},
                        {"task": "T9", "reason": "both modify service code"},
                        {"task": "T21b", "reason": "both modify service code"}
                    ]
                }
            ])
        elif task_id == 'T5':
            # T5 split by types vs services
            improved_conflicts.extend([
                {
                    "task_id": "T5a",
                    "size": "S",
                    "expected_runtime_min": 15,
                    "conflicts_with": ["T6a3", "T21c"],  # Only type conflicts
                    "reasons": [
                        {"task": "T6a3", "reason": "both modify type files"},
                        {"task": "T21c", "reason": "both modify type files"}
                    ]
                },
                {
                    "task_id": "T5b",
                    "size": "S", 
                    "expected_runtime_min": 12,
                    "conflicts_with": ["T2a2", "T6a2", "T9", "T21b"],  # Service conflicts
                    "reasons": [
                        {"task": "T2a2", "reason": "both modify service files"},
                        {"task": "T6a2", "reason": "both modify service files"}, 
                        {"task": "T9", "reason": "both modify service files"},
                        {"task": "T21b", "reason": "both modify service files"}
                    ]
                }
            ])
        elif task_id == 'T1':
            # T1 split has no conflicts since they're infrastructure
            improved_conflicts.extend([
                {"task_id": "T1a", "size": "S", "expected_runtime_min": 12, "conflicts_with": [], "reasons": []},
                {"task_id": "T1b", "size": "S", "expected_runtime_min": 10, "conflicts_with": [], "reasons": []},
                {"task_id": "T1c", "size": "S", "expected_runtime_min": 8, "conflicts_with": [], "reasons": []}
            ])
        else:
            # Update conflicts that referenced split tasks
            updated_conflict = deepcopy(conflict)
            new_conflicts = []
            new_reasons = []
            
            for i, conflicted_task in enumerate(conflict['conflicts_with']):
                if conflicted_task == 'T6a':
                    # May conflict with some T6a subtasks depending on file overlap
                    if task_id in ['T2a', 'T5', 'T9', 'T21']:  # Tasks that had broad conflicts
                        new_conflicts.extend(['T6a1', 'T6a2'])  # Still conflicts with handler/service parts
                        new_reasons.extend([
                            {"task": "T6a1", "reason": conflict['reasons'][i]['reason']},
                            {"task": "T6a2", "reason": conflict['reasons'][i]['reason']}
                        ])
                elif conflicted_task in ['T2a', 'T5', 'T21', 'T1']:
                    # These were split, so add conflicts with relevant subtasks
                    if conflicted_task == 'T2a':
                        new_conflicts.extend(['T2a1', 'T2a2'])
                    elif conflicted_task == 'T5':
                        new_conflicts.extend(['T5a', 'T5b'])
                    elif conflicted_task == 'T21':
                        new_conflicts.extend(['T21a', 'T21b', 'T21c'])
                    elif conflicted_task == 'T1':
                        new_conflicts.extend(['T1a', 'T1b', 'T1c'])
                    
                    # Add corresponding reasons
                    for subtask in new_conflicts[-3:] if conflicted_task == 'T21' else new_conflicts[-2:]:
                        new_reasons.append({"task": subtask, "reason": conflict['reasons'][i]['reason']})
                else:
                    new_conflicts.append(conflicted_task)
                    new_reasons.append(conflict['reasons'][i])
            
            updated_conflict['conflicts_with'] = new_conflicts
            updated_conflict['reasons'] = new_reasons
            improved_conflicts.append(updated_conflict)
    
    return improved_conflicts

def main():
    # Create improved dependency and conflict graphs
    improved_deps = create_improved_dependencies()
    improved_conflicts = create_improved_conflicts()
    
    # Save improved graphs
    with open('improved_dependency_graph.json', 'w') as f:
        json.dump(improved_deps, f, indent=2)
    
    with open('improved_conflict_graph.json', 'w') as f:
        json.dump(improved_conflicts, f, indent=2)
    
    print(f"Created improved dependency graph with {len(improved_deps)} tasks")
    print(f"Created improved conflict graph with {len(improved_conflicts)} tasks")
    print("Saved to: improved_dependency_graph.json, improved_conflict_graph.json")

if __name__ == "__main__":
    main()