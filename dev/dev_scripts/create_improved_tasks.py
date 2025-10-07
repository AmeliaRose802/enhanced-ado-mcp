#!/usr/bin/env python3
"""
Task Splitter for Improved Parallelism

This script creates an improved task list by splitting high-conflict tasks
into smaller, more parallelizable units.
"""

import json
from copy import deepcopy

def create_improved_task_list():
    # Load original optimized task list
    with open('optimized_task_list.json', 'r') as f:
        original_tasks = json.load(f)
    
    improved_tasks = []
    
    for task_group in original_tasks:
        original_task_id = task_group['original_task_id']
        
        # Apply specific improvements based on analysis
        if original_task_id == 'T6':  # Logging task
            improved_tasks.append(create_split_logging_tasks(task_group))
        elif original_task_id == 'T21':  # Verbosity task  
            improved_tasks.append(create_split_verbosity_tasks(task_group))
        elif original_task_id == 'T2':  # Naming/imports task
            improved_tasks.append(create_split_naming_tasks(task_group))
        elif original_task_id == 'T5':  # Types task
            improved_tasks.append(create_split_types_tasks(task_group))
        elif original_task_id == 'T1':  # Dev infrastructure 
            improved_tasks.append(create_split_dev_infrastructure(task_group))
        else:
            # Keep other tasks as-is
            improved_tasks.append(task_group)
    
    return improved_tasks

def create_split_logging_tasks(original_group):
    """Split T6a logging task by directory to reduce conflicts"""
    base_task = original_group['derived_tasks'][0]  # T6a
    t6b_task = original_group['derived_tasks'][1]   # T6b
    
    # Split T6a into directory-specific tasks
    new_derived_tasks = [
        {
            "task_id": "T6a1",
            "summary": "Implement structured logging in handlers directory",
            "size": "S",
            "expected_runtime_min": 12,
            "files": ["mcp_server/src/services/handlers/**/*.ts", "package.json"],
            "tags": ["infrastructure", "code_update"],
            "description": "Replace console.log/error with structured logger in handlers directory only"
        },
        {
            "task_id": "T6a2", 
            "summary": "Implement structured logging in services directory",
            "size": "S",
            "expected_runtime_min": 8,
            "files": ["mcp_server/src/services/*.ts", "mcp_server/src/utils/logger.ts"],
            "tags": ["infrastructure", "code_update"],
            "description": "Replace console.log/error with structured logger in services directory"
        },
        {
            "task_id": "T6a3",
            "summary": "Implement structured logging in types and config",
            "size": "S", 
            "expected_runtime_min": 6,
            "files": ["mcp_server/src/types/**/*.ts", "mcp_server/src/config/**/*.ts"],
            "tags": ["infrastructure", "code_update"],
            "description": "Replace console.log/error with structured logger in types and config"
        },
        # Keep T6b as-is but adjust dependencies
        {
            **t6b_task,
            # T6b now depends on completion of logging setup
        }
    ]
    
    return {
        **original_group,
        "derived_tasks": new_derived_tasks,
        "optimization_reason": "Split logging task by directory to enable parallel implementation and reduce file conflicts"
    }

def create_split_verbosity_tasks(original_group):
    """Split T21 verbosity task by file area to reduce conflicts"""
    base_task = original_group['derived_tasks'][0]
    
    new_derived_tasks = [
        {
            "task_id": "T21a",
            "summary": "Reduce verbosity in handlers directory",
            "size": "S",
            "expected_runtime_min": 12,
            "files": ["mcp_server/src/services/handlers/**/*.ts"],
            "tags": ["cleanup", "optimization"],
            "description": "Comprehensive verbosity reduction in handlers directory using janitor approach"
        },
        {
            "task_id": "T21b", 
            "summary": "Reduce verbosity in services directory",
            "size": "S",
            "expected_runtime_min": 10,
            "files": ["mcp_server/src/services/*.ts"],
            "tags": ["cleanup", "optimization"], 
            "description": "Comprehensive verbosity reduction in services directory"
        },
        {
            "task_id": "T21c",
            "summary": "Reduce verbosity in types and utils",
            "size": "S",
            "expected_runtime_min": 8,
            "files": ["mcp_server/src/types/**/*.ts", "mcp_server/src/utils/**/*.ts"],
            "tags": ["cleanup", "optimization"],
            "description": "Comprehensive verbosity reduction in types and utilities"
        }
    ]
    
    return {
        **original_group,
        "derived_tasks": new_derived_tasks,
        "optimization_reason": "Split verbosity cleanup by directory to enable parallel execution and reduce conflicts"
    }

def create_split_naming_tasks(original_group):
    """Split T2a naming task by concern type"""
    t2a_task = original_group['derived_tasks'][0]
    t2b_task = original_group['derived_tasks'][1]
    
    new_derived_tasks = [
        {
            "task_id": "T2a1",
            "summary": "Standardize file and directory naming conventions",
            "size": "S", 
            "expected_runtime_min": 15,
            "files": ["mcp_server/src/**/*.ts"],  # Still broad but focused on file renames
            "tags": ["refactor", "code_quality"],
            "description": "Standardize file naming to kebab-case and directory structure"
        },
        {
            "task_id": "T2a2",
            "summary": "Standardize function and variable naming conventions", 
            "size": "M",
            "expected_runtime_min": 20,
            "files": ["mcp_server/src/**/*.ts"],
            "tags": ["refactor", "code_quality"],
            "description": "Standardize function naming to consistent verbs, variable naming to camelCase/PascalCase"
        },
        # Keep T2b as-is
        t2b_task
    ]
    
    return {
        **original_group,
        "derived_tasks": new_derived_tasks,
        "optimization_reason": "Split naming standardization into file-level and code-level concerns for better focus"
    }

def create_split_types_tasks(original_group):
    """Split T5 types task to reduce service conflicts"""
    base_task = original_group['derived_tasks'][0]
    
    new_derived_tasks = [
        {
            "task_id": "T5a",
            "summary": "Consolidate and improve ADO type definitions",
            "size": "S",
            "expected_runtime_min": 15,
            "files": ["mcp_server/src/types/**/*.ts"],
            "tags": ["types", "code_quality"],
            "description": "Create proper type hierarchy with barrel exports for ADO types"
        },
        {
            "task_id": "T5b", 
            "summary": "Remove 'any' types from service implementations",
            "size": "S",
            "expected_runtime_min": 12,
            "files": ["mcp_server/src/services/**/*.ts"],
            "tags": ["types", "code_quality"],
            "description": "Eliminate all 'any' type usage in services with proper typing"
        }
    ]
    
    return {
        **original_group,
        "derived_tasks": new_derived_tasks,
        "optimization_reason": "Split types task to separate type definitions from service implementation"
    }

def create_split_dev_infrastructure(original_group):
    """Split T1 dev infrastructure into more parallel tasks"""
    base_task = original_group['derived_tasks'][0]
    
    new_derived_tasks = [
        {
            "task_id": "T1a",
            "summary": "Setup ESLint and Prettier configuration",
            "size": "S",
            "expected_runtime_min": 12,
            "files": [".eslintrc.json", ".prettierrc", "package.json"],
            "tags": ["dev-infrastructure", "code_quality"],
            "description": "Configure ESLint and Prettier with appropriate rules"
        },
        {
            "task_id": "T1b",
            "summary": "Setup GitHub Actions CI pipeline",  
            "size": "S",
            "expected_runtime_min": 10,
            "files": [".github/workflows/lint.yml"],
            "tags": ["dev-infrastructure", "ci_cd"],
            "description": "Create GitHub Actions workflow for linting and formatting"
        },
        {
            "task_id": "T1c",
            "summary": "Setup Husky pre-commit hooks",
            "size": "S", 
            "expected_runtime_min": 8,
            "files": [".husky/pre-commit", "package.json"],
            "tags": ["dev-infrastructure", "code_quality"],
            "description": "Configure Husky pre-commit hooks for code quality enforcement"
        }
    ]
    
    return {
        **original_group,
        "derived_tasks": new_derived_tasks,
        "optimization_reason": "Split dev infrastructure setup into parallel configuration tasks",
        "enabler": True,
        "acceleration_effect": {"type": "percent", "value": 15},
        "acceleration_scope": {"tags": ["code_update", "refactor"], "task_ids": [], "globs": ["mcp_server/src/**"]},
        "half_life_waves": 2
    }

def create_improved_dependencies(improved_tasks):
    """Generate dependency graph for improved tasks"""
    # Load original dependencies
    with open('dependency_graph.json', 'r') as f:
        original_deps = json.load(f)
    
    # Create dependency mapping
    dep_map = {dep['task_id']: dep for dep in original_deps}
    
    improved_deps = []
    
    for group in improved_tasks:
        original_id = group['original_task_id']
        derived_tasks = group['derived_tasks']
        
        # Get original dependencies
        original_dep = dep_map.get(original_id.replace('a', '').replace('b', '').replace('c', ''), {})
        base_depends_on = original_dep.get('depends_on', [])
        
        # For split tasks, create dependencies
        if len(derived_tasks) > 1:
            for i, task in enumerate(derived_tasks):
                # Update dependencies to use new task IDs
                updated_depends_on = []
                for dep in base_depends_on:
                    # Map old task IDs to new split task IDs
                    if dep in ['T1', 'T2a', 'T2b', 'T5', 'T6a', 'T21']:
                        # Depend on all subtasks of split dependency
                        if dep == 'T1':
                            updated_depends_on.extend(['T1a', 'T1b', 'T1c'])
                        elif dep == 'T2a':
                            updated_depends_on.extend(['T2a1', 'T2a2'])
                        elif dep == 'T5':
                            updated_depends_on.extend(['T5a', 'T5b'])
                        elif dep == 'T6a':
                            updated_depends_on.extend(['T6a1', 'T6a2', 'T6a3'])
                        elif dep == 'T21':
                            updated_depends_on.extend(['T21a', 'T21b', 'T21c'])
                        else:
                            updated_depends_on.append(dep)
                    else:
                        updated_depends_on.append(dep)
                
                improved_deps.append({
                    'task_id': task['task_id'],
                    'depends_on': updated_depends_on,
                    'confidence': original_dep.get('confidence', 'high'),
                    'reason': original_dep.get('reason', 'Derived from original task'),
                    'size': task['size'],
                    'expected_runtime_min': task['expected_runtime_min'],
                    'enabler': group.get('enabler', False)
                })
        else:
            # Single task - keep as-is with updated dependencies
            task = derived_tasks[0]
            updated_depends_on = []
            for dep in base_depends_on:
                if dep in ['T1', 'T2a', 'T2b', 'T5', 'T6a', 'T21']:
                    if dep == 'T1':
                        updated_depends_on.extend(['T1a', 'T1b', 'T1c'])
                    elif dep == 'T2a':
                        updated_depends_on.extend(['T2a1', 'T2a2'])
                    elif dep == 'T5':
                        updated_depends_on.extend(['T5a', 'T5b'])
                    elif dep == 'T6a':
                        updated_depends_on.extend(['T6a1', 'T6a2', 'T6a3'])
                    elif dep == 'T21':
                        updated_depends_on.extend(['T21a', 'T21b', 'T21c'])
                else:
                    updated_depends_on.append(dep)
            
            improved_deps.append({
                'task_id': task['task_id'],
                'depends_on': updated_depends_on,
                'confidence': original_dep.get('confidence', 'high'),
                'reason': original_dep.get('reason', 'Original task preserved'),
                'size': task['size'],
                'expected_runtime_min': task['expected_runtime_min'],
                'enabler': group.get('enabler', False)
            })
    
    return improved_deps

def create_improved_conflicts(improved_tasks):
    """Generate conflict graph for improved tasks"""
    # Load original conflicts
    with open('conflict_graph.json', 'r') as f:
        original_conflicts = json.load(f)
    
    # Create conflict mapping
    conflict_map = {conf['task_id']: conf for conf in original_conflicts}
    
    improved_conflicts = []
    
    for group in improved_tasks:
        original_id = group['original_task_id']
        derived_tasks = group['derived_tasks']
        
        # Get original conflicts
        original_conflict = conflict_map.get(original_id.replace('a', '').replace('b', '').replace('c', ''), {})
        base_conflicts = original_conflict.get('conflicts_with', [])
        
        # For split tasks, reduce conflicts by directory separation
        if len(derived_tasks) > 1:
            for task in derived_tasks:
                task_id = task['task_id']
                files = task.get('files', [])
                
                # Determine which conflicts still apply based on file paths
                task_conflicts = []
                task_reasons = []
                
                for conflict_id in base_conflicts:
                    # Check if the conflicted task overlaps with this subtask's files
                    # Simplified heuristic: if file paths share common patterns, keep conflict
                    should_conflict = False
                    
                    # Directory-based conflict detection
                    if 'handlers' in str(files) and task_id.endswith('1'):
                        if conflict_id in conflict_map:
                            conflict_files = conflict_map[conflict_id].get('files', [])
                            if any('handlers' in str(f) for f in conflict_files):
                                should_conflict = True
                    elif 'services' in str(files) and task_id.endswith('2'):
                        if conflict_id in conflict_map:
                            conflict_files = conflict_map[conflict_id].get('files', [])
                            if any('services' in str(f) for f in conflict_files):
                                should_conflict = True
                    elif 'types' in str(files) and task_id.endswith('3'):
                        if conflict_id in conflict_map:
                            conflict_files = conflict_map[conflict_id].get('files', [])
                            if any('types' in str(f) for f in conflict_files):
                                should_conflict = True
                    
                    if should_conflict:
                        # Map old conflict IDs to new ones
                        if conflict_id in ['T1', 'T2a', 'T2b', 'T5', 'T6a', 'T21']:
                            # Add conflicts with relevant subtasks
                            if conflict_id == 'T1':
                                task_conflicts.extend(['T1a', 'T1b', 'T1c'])
                            elif conflict_id == 'T2a':
                                task_conflicts.extend(['T2a1', 'T2a2'])
                            elif conflict_id == 'T5':
                                task_conflicts.extend(['T5a', 'T5b'])
                            elif conflict_id == 'T6a':
                                task_conflicts.extend(['T6a1', 'T6a2', 'T6a3'])
                            elif conflict_id == 'T21':
                                task_conflicts.extend(['T21a', 'T21b', 'T21c'])
                        else:
                            task_conflicts.append(conflict_id)
                        
                        # Find original reason
                        original_reason = next(
                            (r for r in original_conflict.get('reasons', []) if r['task'] == conflict_id),
                            {'reason': 'File overlap'}
                        )
                        task_reasons.append({
                            'task': conflict_id,
                            'reason': original_reason['reason']
                        })
                
                improved_conflicts.append({
                    'task_id': task_id,
                    'size': task['size'],
                    'expected_runtime_min': task['expected_runtime_min'],
                    'conflicts_with': task_conflicts,
                    'reasons': task_reasons
                })
        else:
            # Single task - update conflict references
            task = derived_tasks[0]
            updated_conflicts = []
            updated_reasons = []
            
            for conflict_id in base_conflicts:
                if conflict_id in ['T1', 'T2a', 'T2b', 'T5', 'T6a', 'T21']:
                    if conflict_id == 'T1':
                        updated_conflicts.extend(['T1a', 'T1b', 'T1c'])
                    elif conflict_id == 'T2a':
                        updated_conflicts.extend(['T2a1', 'T2a2'])
                    elif conflict_id == 'T5':
                        updated_conflicts.extend(['T5a', 'T5b'])
                    elif conflict_id == 'T6a':
                        updated_conflicts.extend(['T6a1', 'T6a2', 'T6a3'])
                    elif conflict_id == 'T21':
                        updated_conflicts.extend(['T21a', 'T21b', 'T21c'])
                else:
                    updated_conflicts.append(conflict_id)
            
            # Copy reasons
            for reason in original_conflict.get('reasons', []):
                updated_reasons.append(reason)
            
            improved_conflicts.append({
                'task_id': task['task_id'],
                'size': task['size'],
                'expected_runtime_min': task['expected_runtime_min'],
                'conflicts_with': updated_conflicts,
                'reasons': updated_reasons
            })
    
    return improved_conflicts

def main():
    improved_tasks = create_improved_task_list()
    improved_deps = create_improved_dependencies(improved_tasks)
    improved_conflicts = create_improved_conflicts(improved_tasks)
    
    # Save all artifacts
    with open('optimized_task_list.json', 'w') as f:
        json.dump(improved_tasks, f, indent=2)
    
    with open('dependency_graph.json', 'w') as f:
        json.dump(improved_deps, f, indent=2)
    
    with open('conflict_graph.json', 'w') as f:
        json.dump(improved_conflicts, f, indent=2)
    
    # Calculate statistics
    with open('optimized_task_list.json', 'r') as f:
        original_count = len(json.load(f))
    improved_count = sum(len(group['derived_tasks']) for group in improved_tasks)
    
    print(f"Improved tasks: {improved_count}")
    print(f"Task increase: {improved_count - original_count} (+{((improved_count/original_count)-1)*100:.1f}%)")
    print(f"\nGenerated artifacts:")
    print(f"  - optimized_task_list.json ({len(improved_tasks)} task groups)")
    print(f"  - dependency_graph.json ({len(improved_deps)} tasks)")
    print(f"  - conflict_graph.json ({len(improved_conflicts)} tasks)")

if __name__ == "__main__":
    main()